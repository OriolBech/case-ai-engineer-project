/**
 * Stage 5 — rules engine and resolution. See specs/SPEC-005-validator.md.
 *
 * Deterministic and reproducible: the challenge asks for the trace of specific rows, and every
 * decision here records the rule or policy that produced it. This is also where every policy from
 * docs/03-policies.md is applied — nowhere else. If the pipeline decides something that is neither
 * in the client's rules nor in this file, that is a bug.
 */

import type { NormalizedElement } from './normalize.ts';
import type { Analysis } from './analyze.ts';
import type { Policies } from '../rules/policies.ts';
import { DEFAULT_POLICIES } from '../rules/policies.ts';
import { checkCoherence } from '../rules/quality.ts';
import { deriveMaterialFromQuality } from '../rules/material.ts';
import { resolveLength, formatLength } from './measure.ts';
import {
  LENGTH_EXEMPT, type Attributes, type ItemName, type MtoRow,
  type OutputLine, type Reason, type ReasonCode, type ReasonKind,
} from './types.ts';

const MESSAGES: Record<ReasonCode, string> = {
  QUALITY_MISSING: 'El MTO no indica la calidad de este elemento',
  STANDARD_MISSING: 'El MTO no indica la norma de este elemento',
  MEASURE_MISSING: 'El MTO no indica la medida',
  LENGTH_MISSING: 'El MTO no indica la longitud, y es obligatoria para este tipo',
  NAME_MISSING: 'No se reconoce el tipo de material',
  QUANTITY_NOT_STATED: 'La descripción no dice cuántas unidades por conjunto',
  QUALITY_TYPE_INCOHERENCE: 'La calidad no corresponde a este tipo de elemento',
  UNIT_MISMATCH: 'Medida y longitud están en sistemas distintos',
  LENGTH_UNIT_IMPLAUSIBLE: 'La longitud no lleva unidad y no se puede deducir con seguridad',
  LOW_CONFIDENCE: 'Varios datos son inferidos: conviene revisarlo',
  CRITIC_DISAGREES: 'La revisión automática no cuadra con el texto original',
  UNMAPPED_VALUE: 'Un valor no está en los catálogos del proyecto',
  OUT_OF_FAMILY: 'Esta línea no es tornillería',
  EMPTY_DESCRIPTION: 'La fila no trae descripción: no hay nada que extraer',
  PROCESSING_FAILED: 'No se ha podido procesar esta fila. No es un juicio sobre el material.',
  NO_ELEMENTS_EXTRACTED:
    'No se ha podido identificar ningún material en esta fila, aunque tiene descripción. ' +
    'Requiere lectura manual.',
  FINISH_SCOPE_UNSTATED:
    'La fila indica un acabado pero no dice si se aplica a este elemento. Un elemento con acabado y ' +
    'el mismo sin acabado son referencias distintas, así que no se decide por el cliente.',
};

const KINDS: Record<ReasonCode, ReasonKind> = {
  QUALITY_MISSING: 'MISSING_IN_SOURCE',
  STANDARD_MISSING: 'MISSING_IN_SOURCE',
  MEASURE_MISSING: 'MISSING_IN_SOURCE',
  LENGTH_MISSING: 'MISSING_IN_SOURCE',
  NAME_MISSING: 'MISSING_IN_SOURCE',
  QUANTITY_NOT_STATED: 'MISSING_IN_SOURCE',
  OUT_OF_FAMILY: 'MISSING_IN_SOURCE',
  EMPTY_DESCRIPTION: 'MISSING_IN_SOURCE',
  PROCESSING_FAILED: 'LOW_CONFIDENCE',
  FINISH_SCOPE_UNSTATED: 'MISSING_IN_SOURCE',
  NO_ELEMENTS_EXTRACTED: 'LOW_CONFIDENCE',
  QUALITY_TYPE_INCOHERENCE: 'INCOHERENCE',
  UNIT_MISMATCH: 'INCOHERENCE',
  LENGTH_UNIT_IMPLAUSIBLE: 'INCOHERENCE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  CRITIC_DISAGREES: 'LOW_CONFIDENCE',
  UNMAPPED_VALUE: 'LOW_CONFIDENCE',
};

function reason(code: ReasonCode, attribute: keyof Attributes | null = null): Reason {
  return { code, kind: KINDS[code], message: MESSAGES[code], attribute };
}

export interface ValidateOptions {
  policies?: Policies;
}

export function validateRow(
  analysis: Analysis,
  elements: NormalizedElement[],
  row: MtoRow,
  opts: ValidateOptions = {},
): OutputLine[] {
  const P = opts.policies ?? DEFAULT_POLICIES;

  // --- P-9: the row is not a fastener ------------------------------------
  if (analysis.outOfFamily) {
    if (P.outOfFamily === 'silent_skip') return [];
    return [outOfFamilyLine(row, analysis)];
  }
  // A row whose model call failed is surfaced, never dropped: an absent line reads as "nothing to
  // buy here", which is the one thing it must not read as.
  if (analysis.error) return [failedLine(row, analysis.error.message)];
  // No description at all: reported as its own reason, never dropped in silence.
  if (analysis.skippedLlm) return [emptyLine(row)];
  // A row with a description that yielded nothing is REPORTED, never dropped. Returning [] here is
  // how a row vanishes from the output entirely.
  if (!elements.length) return [noElementsLine(row)];

  // --- §2: the ONLY extrapolation the rules allow is the measure ----------
  const withMeasure = elements.filter((e) => e.measure.normalized !== null);
  const donor =
    withMeasure.find((e) => e.role === 'principal') ?? withMeasure[0] ?? null;

  // --- P-1: scope of a finish written once for the whole row ---------------
  // The client settled it: only the measure extrapolates. What remains is that a finish stated once
  // for a multi-element row is present and UNATTRIBUTED, which is not the same as absent.
  const finishDonor = elements.find((e) => e.finish.normalized !== null) ?? null;
  const rowLevelFinish = finishDonor && elements.length > 1 ? finishDonor : null;

  return elements.map((el, i) =>
    buildLine(el, { row, donor, rowLevelFinish, P, elementCount: elements.length, index: i }));
}

interface Ctx {
  row: MtoRow;
  donor: NormalizedElement | null;
  rowLevelFinish: NormalizedElement | null;
  P: Policies;
  elementCount: number;
  index: number;
}

function buildLine(el: NormalizedElement, ctx: Ctx): OutputLine {
  const { row, donor, rowLevelFinish, P } = ctx;
  const reasons: Reason[] = [];
  const policies = new Set<string>();

  const name = el.name.normalized;
  if (!name) reasons.push(reason('NAME_MISSING', 'name'));

  // --- measure, with the one legal extrapolation --------------------------
  let measure = el.measure;
  let parsedMeasure = el.parsedMeasure;
  if (!measure.normalized && donor && donor !== el && donor.measure.normalized) {
    measure = { ...donor.measure, provenance: 'extrapolated', rule: 'rule:§2:measure_extrapolated' };
    parsedMeasure = donor.parsedMeasure;
  }
  if (!measure.normalized) reasons.push(reason('MEASURE_MISSING', 'measure'));

  // --- length (§7 obligation + P-4 unit) ----------------------------------
  const exempt = name !== null && LENGTH_EXEMPT.includes(name);
  // The designation is the fallback, not the first choice: if the extractor placed a length we use
  // that one, with its own span. Row 4 is why the fallback exists — the model returned
  // `measure: "M16x60"` and `length: null`, and a line the row states unambiguously was going to
  // review with LENGTH_MISSING. The diameter and the length are one string in an ISO designation,
  // and splitting it is a regex, not a judgement.
  //
  // But ONLY from this element's OWN measure. An extrapolated `M16x60` carries the principal's
  // length inside it, and taking it would extrapolate the LENGTH across the set while calling it a
  // measure — precisely the thing §2 allows for the measure and nothing else. The invariant has to
  // survive the shortcut that makes it convenient to break.
  const ownDesignationLength = measure.provenance === 'extrapolated' ? null : parsedMeasure?.lengthRaw ?? null;
  const lengthRaw = el.lengthRaw ?? ownDesignationLength;
  const lengthSpan = el.lengthRaw !== null ? el.lengthSpan : measure.span;
  let length: Attributes['length'];
  if (exempt) {
    length = { raw: el.lengthRaw, normalized: 'N/A', provenance: 'not_applicable', span: el.lengthSpan, rule: 'rule:§7:exempt' };
  } else if (lengthRaw === null) {
    length = { raw: null, normalized: null, provenance: 'absent', span: null, rule: null };
    reasons.push(reason('LENGTH_MISSING', 'length'));
  } else {
    const r = resolveLength(lengthRaw, parsedMeasure);
    if (r === null) {
      length = { raw: lengthRaw, normalized: null, provenance: 'absent', span: lengthSpan, rule: 'length:unparsed' };
      reasons.push(reason('LENGTH_MISSING', 'length'));
    } else if (r.implausible || P.unitlessLength === 'review') {
      const ambiguous = r.implausible || (!r.implausible && r.basis === 'plausibility');
      if (ambiguous) {
        length = { raw: lengthRaw, normalized: null, provenance: 'absent', span: lengthSpan, rule: 'P-4:implausible' };
        reasons.push(reason('LENGTH_UNIT_IMPLAUSIBLE', 'length'));
        policies.add('P-4');
      } else {
        length = { raw: lengthRaw, normalized: formatLength(r), provenance: 'extracted', span: lengthSpan, rule: `length:${r.basis}` };
      }
    } else {
      // 'stated' and 'designation' are certain; only 'plausibility' is policy-dependent.
      const isPolicy = r.basis === 'plausibility';
      if (isPolicy) policies.add('P-4');
      length = {
        raw: lengthRaw,
        normalized: formatLength(r),
        provenance: isPolicy ? 'inferred' : 'extracted',
        span: lengthSpan,
        rule: `length:${r.basis}`,
      };
      // §6: no equivalence between systems, so a mismatch is an incoherence, not a conversion.
      if (parsedMeasure && r.basis === 'stated') {
        const mixed =
          (parsedMeasure.system === 'metric' && r.unit === 'inch') ||
          (parsedMeasure.system === 'imperial' && r.unit === 'mm');
        if (mixed) reasons.push(reason('UNIT_MISMATCH', 'length'));
      }
    }
  }

  // --- quality: never extrapolated (§2, and the case statement is explicit) ---
  const quality = el.quality;
  if (!quality.normalized) {
    reasons.push(reason('QUALITY_MISSING', 'quality'));
  } else if (name && el.qualityResult) {
    const inc = checkCoherence(el.qualityResult, name, {
      hvAppliesToWashersOnly: P.hvScope === 'washer_only',
    });
    if (inc) {
      if (P.qualityCoherence === 'review') reasons.push(reason('QUALITY_TYPE_INCOHERENCE', 'quality'));
      policies.add(inc === 'HV_OUTSIDE_WASHER' ? 'P-8' : 'P-6');
    }
  }

  // --- standard (P-5) -----------------------------------------------------
  const standard = el.standard;
  if (!standard.normalized) {
    if (P.missingStandard === 'review') reasons.push(reason('STANDARD_MISSING', 'standard'));
    policies.add('P-5');
  }

  // --- material: extracted, or derived from the quality (P-3) -------------
  let material = el.material;
  if (!material.normalized && P.materialDerivation === 'from_quality' && quality.raw) {
    const d = deriveMaterialFromQuality(quality.raw);
    if (d.material !== null) {
      material = { raw: null, normalized: d.material, provenance: 'derived', span: quality.span, rule: d.rule };
      policies.add('P-3');
    } else if (d.why.reason === 'ambiguous') {
      // La tabla cubre esta calidad DOS veces con materiales distintos. Es el único caso de los tres
      // que manda la línea a revisión, y es la respuesta literal a la Q3 del correo: "cualquier
      // calidad no cubierta o NO UNÍVOCA irá a revisión". No se elige la primera entrada: elegir por
      // orden de fichero es un default disparándose en silencio, y el material equivocado es la
      // compra equivocada.
      const which = d.why.candidates.map((c) => `${c.entryId} (${c.material})`).join(' vs ');
      reasons.push({
        code: 'UNMAPPED_VALUE',
        kind: 'LOW_CONFIDENCE',
        message: `La calidad ${quality.raw} deriva a dos materiales distintos según la tabla: ${which}. `
          + 'El vocabulario debe una desambiguación.',
        attribute: 'material',
      });
      policies.add('P-3');
    }
    // 'uncovered' NO añade motivo aquí: lo recoge coverage.ts como hueco de política, que es un canal
    // distinto —una decisión que el proyecto debe, no un dato que el comprador pueda arreglar.
    // 'deliberate' es una ausencia válida y declarada: no es un hueco ni una revisión.
  }
  // §5's only written review rule is the quality one; an absent material never blocks. §9 sets the
  // precedent: an empty attribute can be a valid, resolved value.

  // --- finish (P-1) -------------------------------------------------------
  let finish = el.finish;
  if (!finish.normalized && rowLevelFinish && rowLevelFinish !== el) {
    policies.add('P-1');
    if (P.finishSetScope === 'whole_set') {
      finish = { ...rowLevelFinish.finish, provenance: 'extrapolated', rule: 'P-1:finish_whole_set' };
    } else if (P.finishSetScope === 'review') {
      // Present in the row, not attributable to this element. Reported as such, not as absent.
      finish = { raw: rowLevelFinish.finish.raw, normalized: null, provenance: 'absent', span: rowLevelFinish.finish.span, rule: 'P-1:scope_unstated' };
      reasons.push(reason('FINISH_SCOPE_UNSTATED', 'finish'));
    }
    // 'principal_only' leaves the secondary with no finish and no reason.
  }

  // --- quantity (P-2). Not one of the seven attributes, and it does not block ---
  const rowQty = ctx.row.quantity;
  const quantity = rowQty === null ? null : rowQty * el.multiplicity;
  let quantityProvenance: OutputLine['quantityProvenance'] = 'extracted';
  if (rowQty === null) {
    quantityProvenance = 'absent';
    reasons.push(reason('QUANTITY_NOT_STATED'));
  } else if (!el.multiplicityStated && ctx.elementCount > 1) {
    quantityProvenance = 'inferred';
    policies.add('P-2');
    if (P.implicitMultiplicity === 'review') reasons.push(reason('QUANTITY_NOT_STATED'));
  }

  const attributes: Attributes = {
    name: el.name,
    material,
    quality,
    measure,
    length,
    standard,
    finish,
  };

  return {
    // Deterministic: row reference plus position within the row. Same input, same ids, always —
    // the trace the challenge asks for has to be reproducible across runs.
    id: `${ctx.row.itemRef}.${ctx.index + 1}`,
    rowRef: ctx.row.itemRef,
    status: reasons.length ? 'REVISION_MANUAL' : 'RESUELTA',
    attributes,
    quantity,
    quantityProvenance,
    reasons,
    confidence: 0, // filled by src/lib/confidence.ts
    policiesApplied: [...policies].sort(),
  };
}

const EMPTY_ATTR = { raw: null, normalized: null, provenance: 'absent' as const, span: null, rule: null };

function emptyLine(row: MtoRow): OutputLine {
  return {
    id: `${row.itemRef}.0`,
    rowRef: row.itemRef,
    status: 'REVISION_MANUAL',
    attributes: {
      name: EMPTY_ATTR, material: EMPTY_ATTR, quality: EMPTY_ATTR, measure: EMPTY_ATTR,
      length: EMPTY_ATTR, standard: EMPTY_ATTR, finish: EMPTY_ATTR,
    },
    quantity: row.quantity,
    quantityProvenance: row.quantity === null ? 'absent' : 'extracted',
    reasons: [reason('EMPTY_DESCRIPTION')],
    confidence: 0,
    policiesApplied: [],
  };
}

function failedLine(row: MtoRow, detail: string): OutputLine {
  const base = emptyLine(row);
  const r = reason('PROCESSING_FAILED');
  return { ...base, id: `${row.itemRef}.E`, reasons: [{ ...r, message: `${r.message} (${detail.split('\n')[0]})` }] };
}

function noElementsLine(row: MtoRow): OutputLine {
  const base = emptyLine(row);
  return { ...base, id: `${row.itemRef}.N`, reasons: [reason('NO_ELEMENTS_EXTRACTED')] };
}

function outOfFamilyLine(row: MtoRow, analysis: Analysis): OutputLine {
  const empty = { raw: null, normalized: null, provenance: 'absent' as const, span: null, rule: null };
  const r = reason('OUT_OF_FAMILY');
  return {
    id: `${row.itemRef}.X`,
    rowRef: row.itemRef,
    status: 'REVISION_MANUAL',
    attributes: {
      name: empty, material: empty, quality: empty, measure: empty,
      length: empty, standard: empty, finish: empty,
    },
    quantity: row.quantity,
    quantityProvenance: row.quantity === null ? 'absent' : 'extracted',
    reasons: [{ ...r, message: analysis.outOfFamilyReason ? `${r.message}: ${analysis.outOfFamilyReason}` : r.message }],
    confidence: 0,
    policiesApplied: ['P-9'],
  };
}

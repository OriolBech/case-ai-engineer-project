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
import { checkCoherence, normalizeQuality } from '../rules/quality.ts';
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
  // Not MISSING_IN_SOURCE: the row is complete, it just is not ours. See ReasonKind.
  OUT_OF_FAMILY: 'OUT_OF_SCOPE',
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

  // --- P-10 / P-11: a bare number is not a measure when the row proves otherwise ---
  elements = rejectBareMeasures(elements, P);

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

/**
 * P-10 · A bare number in the measure field of a set, and P-11 · what it turns out to be.
 *
 * FOUND ON ROW 63 of the synthetic set: `Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10,
 * 2 arandelas DIN 125 200HV`. The extractor put the nut's QUALITY (`10`, group G9) and the washer's
 * STANDARD number (the `125` of `DIN 125`) into their measure fields. Both survived every check the
 * pipeline had: span verification passes because the digits really are in the row, confidence came
 * out at 0.95 because every value was read literally, and coverage scans names, standards, finishes
 * and qualities — not measures. The washer was one policy flag away from RESUELTA with measure 125.
 *
 * The rules settle it without a model. §6: a measure is inches or metric, and there are NO
 * equivalences between the two. §2: the measure is the one attribute that travels across a set. So
 * once one element of the row carries a well-formed measure, a bare number on another element of
 * the same row cannot be a measure of anything — it is a misread, and dropping it lets §2 put the
 * right value there instead.
 *
 * Deliberately narrow. Single-element rows are untouched, so the DIN 7981 `4.8x25` family (rows 42
 * and 43, where `4.8` IS the measure) keeps working. The anchor can be any element, not just the
 * principal: if the extractor put the good measure on the nut, the nut is still the anchor.
 *
 * P-11 is the second half. The rejected value is not discarded blindly: if the catalogue recognises
 * it as a quality AND that quality is coherent with this element's type, it is this element's
 * quality. `10` on a TUERCA is G9, which §5 restricts to nuts — it fits. `125` is in no catalogue,
 * so the washer keeps nothing and §2 gives it the real measure. This is a closed-table reading of a
 * value the extractor had already isolated for this element, not a scan of free text: the line
 * `normalizeQuality` warns about — deciding whether some number in prose is a quality — is not
 * crossed here.
 */
function rejectBareMeasures(elements: NormalizedElement[], P: Policies): NormalizedElement[] {
  if (P.bareMeasureInSet !== 'reject' || elements.length < 2) return elements;
  const anchored = elements.some((e) => e.parsedMeasure && !e.parsedMeasure.bareNumeric);
  if (!anchored) return elements;

  return elements.map((el) => {
    if (!el.parsedMeasure?.bareNumeric) return el;
    const rejected = el.measure.raw;
    const out: NormalizedElement = {
      ...el,
      measure: { ...el.measure, normalized: null, provenance: 'absent', rule: 'P-10:bare_measure_rejected' },
      parsedMeasure: null,
    };
    if (P.rejectedMeasureAsQuality === 'off' || !rejected || el.quality.normalized) return out;

    const q = normalizeQuality(rejected);
    // Both guards matter. Out of catalogue, it is just a number nobody can place. In catalogue but
    // incoherent with the type, promoting it would manufacture the incoherence we report elsewhere.
    if (!q.inCatalog || !el.name.normalized) return out;
    // Con la MISMA lectura de P-8 que usa el validador. Si no, con `hvScope=washer_only` P-11
    // colocaría una dureza en un tornillo y dos líneas más abajo la reportaríamos como incoherente:
    // el sistema discutiendo consigo mismo dentro de la misma fila.
    if (checkCoherence(q, el.name.normalized, { hvAppliesToWashersOnly: P.hvScope === 'washer_only' }) !== null) {
      return out;
    }

    return {
      ...out,
      quality: {
        raw: rejected,
        normalized: rejected.trim(),
        // The row does write it. What was wrong was the field it landed in, not the reading.
        provenance: 'table_normalized',
        span: el.measure.span,
        rule: `P-11:quality_from_rejected_measure:${q.group}`,
      },
      qualityResult: q,
    };
  });
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
  // rejectBareMeasures ran before this and left its trace in the rule, so the line records the
  // policy that fired even though the decision was taken with the whole row in view, not here.
  if (el.measure.rule === 'P-10:bare_measure_rejected') policies.add('P-10');
  if (el.quality.rule?.startsWith('P-11:')) policies.add('P-11');
  let measure = el.measure;
  let parsedMeasure = el.parsedMeasure;
  if (!measure.normalized && donor && donor !== el && donor.measure.normalized) {
    // Si la medida buena llega para tapar una que P-10 descartó, el valor descartado viaja en la
    // regla. Si no, la traza dice "extrapolada" y el `10` que el extractor leyó mal desaparece sin
    // que nadie pueda auditarlo — y la traza por atributo es requisito del challenge.
    const rejected = el.measure.rule === 'P-10:bare_measure_rejected' ? el.measure.raw : null;
    measure = {
      ...donor.measure,
      provenance: 'extrapolated',
      rule: rejected
        ? `rule:§2:measure_extrapolated (P-10 descartó ${JSON.stringify(rejected)})`
        : 'rule:§2:measure_extrapolated',
    };
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
    else if (d.why.reason === 'uncovered' && P.uncoveredMaterial === 'review') {
      // P-13. Antes esto NO añadía motivo: el hueco se lo llevaba coverage.ts al backlog y la línea
      // salía RESUELTA con el material vacío. El canal era correcto —una decisión que el proyecto
      // debe, no un dato que el comprador pueda arreglar— y la conclusión no: de "no es su trabajo
      // decidirlo" no se sigue "puede exportarse al RFQ sin saber si es acero o inoxidable". Son dos
      // cosas distintas, y confundirlas es el default disparándose en silencio que este fichero
      // existe para evitar. Lo que se contestó al cliente en la Q3 lo dice entero: "cualquier
      // calidad NO CUBIERTA o no unívoca irá a revisión" — se aplicaba la segunda mitad y no la
      // primera. El hueco sigue yendo al backlog: cambia el estado de la línea, no el canal.
      reasons.push({
        code: 'UNMAPPED_VALUE',
        kind: 'LOW_CONFIDENCE',
        message: `Ninguna entrada del vocabulario cubre la calidad ${quality.raw}, así que no se sabe `
          + 'si esta pieza es acero o inoxidable. Está pendiente de decidir.',
        attribute: 'material',
      });
      policies.add('P-13');
    } else if (d.why.reason === 'deliberate') {
      // Ausencia decidida, no hueco: la tabla declara esta calidad no derivable CON SU MOTIVO (una
      // dureza HV describe el tratamiento, no el metal base). Se marca la regla para que la traza
      // pueda distinguirla de "nadie lo ha mirado todavía", que es lo que el comprador necesita
      // saber cuando ve el material vacío y ninguna decisión pendiente.
      material = { ...material, rule: 'P-3:no-derivable' };
      policies.add('P-3');
    }
  }
  // §9 sets the precedent that an empty attribute can be a valid, resolved value — but only when the
  // absence is DECIDED. An absence nobody has decided on goes to review under P-13, above.

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

  // --- finish (P-12) ------------------------------------------------------
  if (finish.raw && !finish.normalized && finish.rule === 'finish:ambiguous') {
    policies.add('P-12');
    reasons.push({
      code: 'UNMAPPED_VALUE',
      kind: 'LOW_CONFIDENCE',
      message: `El acabado "${finish.raw}" coincide con varias entradas del vocabulario y necesita desambiguación.`,
      attribute: 'finish',
    });
  } else if (finish.raw && !finish.normalized && finish.rule === 'finish:unmapped') {
    policies.add('P-12');
    if (P.unknownFinish === 'review') {
      reasons.push({
        code: 'UNMAPPED_VALUE',
        kind: 'LOW_CONFIDENCE',
        message: `El acabado "${finish.raw}" no está en el catálogo de §9 ni entre sus alias.`,
        attribute: 'finish',
      });
    }
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

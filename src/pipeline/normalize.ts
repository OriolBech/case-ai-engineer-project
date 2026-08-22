/**
 * Stage 4 — normalization. See specs/SPEC-004-normalizer.md.
 *
 * Thin by design: all the knowledge lives in src/rules as closed tables. This module only maps the
 * raw values the analyzer extracted onto those tables and records which rule fired, so the trace
 * panel can show it.
 *
 * What is NOT here: extrapolation, material derivation, and the length unit. Those depend on the
 * rest of the set or on a policy, so they belong to the validator.
 */

import type { AnalyzedElement } from './analyze.ts';
import { normalizeName, findNames } from '../rules/names.ts';
import { normalizeQuality, type QualityResult } from '../rules/quality.ts';
import { normalizeStandard } from '../rules/standards.ts';
import { normalizeFinish, findFinishes } from '../rules/finish.ts';
import { normalizeMaterial, findMaterials } from '../rules/material.ts';
import { parseMeasure, type ParsedMeasure } from './measure.ts';
import type { Attribute, Finish, ItemName, Span } from './types.ts';

export interface NormalizedElement {
  detectedName: string;
  role: 'principal' | 'secondary';
  span: Span | null;
  multiplicity: number;
  multiplicityStated: boolean;

  name: Attribute<ItemName>;
  material: Attribute<string>;
  quality: Attribute<string>;
  measure: Attribute<string>;
  /** Raw only: the unit is decided by the validator (P-4). */
  lengthRaw: string | null;
  lengthSpan: Span | null;
  standard: Attribute<string>;
  finish: Attribute<Finish>;

  /** Parsed measure, for the validator's length reasoning. Never emitted as a value. */
  parsedMeasure: ParsedMeasure | null;
  /** Full quality result, so the validator can check coherence without re-normalizing. */
  qualityResult: QualityResult | null;
}

const absent = <T>(): Attribute<T> => ({ raw: null, normalized: null, provenance: 'absent', span: null, rule: null });

export function normalizeElement(el: AnalyzedElement): NormalizedElement {
  // --- name ---------------------------------------------------------------
  //
  // The TABLE decides, not the model's own classification.
  //
  // The two are different things and the distinction earns its keep: the model reports the literal
  // term it found (`detectedName`) AND its guess at which of the five catalogue values it is
  // (`normalizedName`). §3's alias table maps the former with total reliability — it is a closed
  // list — so the model's guess only gets a say when the table cannot decide.
  //
  // Measured, not assumed: `gpt-oss-120b` returned detectedName "STUD BOLT" and classified it as
  // VARILLA ROSCADA on rows 1 and 12. Those two cells were its ONLY errors in the whole MTO. The
  // table maps "STUD BOLT" to ESPARRAGO every time, because `STUD BOLT` is longer than `BOLT` and
  // findAliases matches longest-first.
  const fromTable = findNames(el.detectedName);
  const distinct = new Set(fromTable.map((h) => h.value));
  const tableHit = distinct.size === 1 ? fromTable[0] : null;
  const nameHit =
    tableHit ??
    (el.normalizedName ? normalizeName(el.normalizedName) : null) ??
    normalizeName(el.detectedName);
  const name: Attribute<ItemName> = nameHit
    ? {
        raw: el.detectedName,
        normalized: nameHit.value,
        provenance: 'table_normalized',
        span: el.span,
        // The rule records WHO decided, so the trace panel can show it in the challenge.
        rule: tableHit
          ? `name:table:${nameHit.alias}->${nameHit.value}`
          : `name:model:${el.normalizedName}->${nameHit.value}`,
      }
    : { ...absent<ItemName>(), raw: el.detectedName };

  // --- quality ------------------------------------------------------------
  const rawQuality = el.attributes.quality.value;
  let quality = absent<string>();
  let qualityResult: QualityResult | null = null;
  if (rawQuality) {
    qualityResult = normalizeQuality(rawQuality);
    quality = {
      raw: rawQuality,
      // The value AS WRITTEN, never the group's representative.
      //
      // §5 says two values of the same group are equivalent, and it is tempting to emit the group's
      // first value. That loses specificity: `A4-70` and `A4` are the same group, but `A4-70` is a
      // tighter spec than `A4`, and rewriting what engineering asked for is a spec change made by
      // the system. The group travels alongside (rule: `quality:G3`) and is what the RFQ grouping
      // and the equivalence checks use.
      normalized: rawQuality.trim(),
      provenance: qualityResult.inCatalog ? 'table_normalized' : 'extracted_uncatalogued',
      span: el.attributes.quality.span,
      rule: qualityResult.group ? `quality:${qualityResult.group}` : 'quality:out_of_catalog',
    };
  }

  // --- standard -----------------------------------------------------------
  const rawStandard = el.attributes.standard.value;
  let standard = absent<string>();
  if (rawStandard) {
    const s = normalizeStandard(rawStandard);
    standard = s
      ? {
          raw: rawStandard,
          normalized: s.normalized,
          provenance: s.mapped ? 'table_normalized' : 'extracted',
          span: el.attributes.standard.span,
          rule: s.rule ?? `standard:${s.family}:preserved`,
        }
      : { raw: rawStandard, normalized: null, provenance: 'absent', span: el.attributes.standard.span, rule: 'standard:unparsed' };
  }

  // --- finish -------------------------------------------------------------
  const rawFinish = el.attributes.finish.value;
  let finish = absent<Finish>();
  if (rawFinish) {
    const hit = normalizeFinish(rawFinish) ?? findFinishes(rawFinish)[0] ?? null;
    finish = hit
      ? {
          raw: rawFinish,
          normalized: hit.value,
          provenance: 'table_normalized',
          span: el.attributes.finish.span,
          rule: `finish:${hit.alias}->${hit.value}`,
        }
      : { raw: rawFinish, normalized: null, provenance: 'absent', span: el.attributes.finish.span, rule: 'finish:unmapped' };
  }

  // --- material (extracted only; derivation is P-3, in the validator) -----
  const rawMaterial = el.attributes.material.value;
  let material = absent<string>();
  if (rawMaterial) {
    const hit = normalizeMaterial(rawMaterial) ?? findMaterials(rawMaterial)[0] ?? null;
    material = {
      raw: rawMaterial,
      normalized: hit ? hit.value : rawMaterial,
      provenance: 'extracted',
      span: el.attributes.material.span,
      rule: hit ? `material:${hit.alias}->${hit.value}` : 'material:preserved',
    };
  }

  // --- measure ------------------------------------------------------------
  const rawMeasure = el.attributes.measure.value;
  const parsedMeasure = rawMeasure ? parseMeasure(rawMeasure) : null;
  const measure: Attribute<string> = rawMeasure
    ? {
        raw: rawMeasure,
        normalized: parsedMeasure ? parsedMeasure.canonical : rawMeasure,
        provenance: 'extracted',
        span: el.attributes.measure.span,
        rule: parsedMeasure ? `measure:${parsedMeasure.system}` : 'measure:unparsed',
      }
    : absent<string>();

  return {
    detectedName: el.detectedName,
    role: el.role,
    span: el.span,
    multiplicity: el.multiplicity,
    multiplicityStated: el.multiplicityStated,
    name,
    material,
    quality,
    measure,
    lengthRaw: el.attributes.length.value,
    lengthSpan: el.attributes.length.span,
    standard,
    finish,
    parsedMeasure,
    qualityResult,
  };
}

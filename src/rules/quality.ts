/**
 * Quality catalogue and equivalence groups — reglas_tornilleria.md §5.
 *
 * THE INVARIANT OF THIS FILE: two values of the same group are equivalent; values of different
 * groups are NOT. In particular `8.8` (G5) is not `8` (G8), and nothing in this codebase may
 * convert between them. Silently changing a spec is exactly the expensive error — material that
 * only fails when someone tries to assemble it.
 *
 * Coverage note (docs/09-coverage-and-blind-set.md): the given MTO exercises 5 of these 23 values
 * and 5 of the 14 groups, and every value it uses is already its group's canonical form. This
 * table is therefore almost entirely untested by the provided data, and almost certainly probed
 * by the blind set.
 */

import { fold } from './text.ts';
import type { QualityGroup, ItemName } from '../pipeline/types.ts';
import { resolveGenericAlias } from './generic-alias-db.ts';
import { QUALITY_GROUPS } from './quality-groups.ts';

export { QUALITY_GROUPS };

/** §5: `8` and `10` apply to nuts only — the one type restriction the rules state explicitly. */
export const NUT_ONLY_GROUPS: readonly QualityGroup[] = ['G8', 'G9'];

/**
 * Hardness groups. The rules do NOT restrict these to washers, unlike G8/G9 — see policy P-8.
 * Listed here so the validator can apply P-8 without re-deriving the set.
 */
export const HARDNESS_GROUPS: readonly QualityGroup[] = ['G10', 'G11', 'G12', 'G13', 'G14'];

const BY_VALUE = new Map<string, { group: QualityGroup; canonical: string }>();
for (const [group, values] of QUALITY_GROUPS) {
  for (const v of values) BY_VALUE.set(fold(v), { group, canonical: values[0] });
}

export interface QualityResult {
  /** The value as written in the MTO. */
  raw: string;
  /** First value of its group. Reported alongside the group, never used to overwrite `raw`. */
  canonical: string | null;
  group: QualityGroup | null;
  /**
   * false for values flagged as a quality but outside the list — ASTM grades such as `GR B7`,
   * `GR 2H`, or a set-screw grade like `45H`. §5: these are extracted as-is.
   */
  inCatalog: boolean;
  /** Valor objetivo de una entrada añadida. El pipeline conserva `raw` al emitir calidad. */
  resolved: string;
  /** null para la capa 1; id auditable para un alias de capa 2. */
  aliasEntryId: string | null;
}

/**
 * Normalizes a value the extractor already isolated AND marked as a quality.
 *
 * This function never scans free text. §5 is explicit: *"if it is not known whether a value is
 * flagged as a quality, it is not extracted"* — so deciding that `8` in some prose is a quality
 * is the extractor's job, and guessing it here would manufacture data.
 */
export function normalizeClientQuality(raw: string): QualityResult {
  const hit = BY_VALUE.get(fold(raw));
  if (hit) {
    return {
      raw,
      canonical: hit.canonical,
      group: hit.group,
      inCatalog: true,
      resolved: raw.trim(),
      aliasEntryId: null,
    };
  }
  return {
    raw,
    canonical: null,
    group: null,
    inCatalog: false,
    resolved: raw.trim(),
    aliasEntryId: null,
  };
}

export function normalizeQuality(raw: string): QualityResult {
  const client = normalizeClientQuality(raw);
  if (client.inCatalog) return client;
  const added = resolveGenericAlias('quality', raw);
  if (!added) return client;
  const target = normalizeClientQuality(added.value);
  if (!target.inCatalog) return client;
  return {
    raw,
    canonical: target.canonical,
    group: target.group,
    inCatalog: true,
    resolved: added.value,
    aliasEntryId: added.id,
  };
}

/** Same group => equivalent. Different or unknown group => not equivalent. Never fuzzy. */
/**
 * Equivalencia **de capa 1 solamente**, y hoy no la usa nadie del pipeline.
 *
 * La aclaración no es pedante: `normalizeQuality` no consulta la capa 2 (`quality-db`), así que dos
 * calidades que un comprador declaró equivalentes salen de aquí como distintas — y desde que existen
 * los grupos propios (`V-…`), también dos calidades nuevas del mismo grupo. Quien necesite la
 * equivalencia real tiene que comparar `resolveQuality(x).group` con `resolveQuality(y).group`; esta
 * función se queda porque describe §5 y porque el ciclo de imports impide que consulte la otra capa.
 */
export function areEquivalent(x: string, y: string): boolean {
  const gx = normalizeQuality(x).group;
  const gy = normalizeQuality(y).group;
  return gx !== null && gx === gy;
}

/**
 * Type coherence. Returns the reason for the incoherence, or null.
 * `hvAppliesToWashersOnly` is policy P-8; default false, per docs/03-policies.md#p-8.
 */
export function checkCoherence(
  q: QualityResult,
  name: ItemName,
  opts: { hvAppliesToWashersOnly?: boolean } = {},
): 'NUT_ONLY_QUALITY_ON_NON_NUT' | 'NON_NUT_QUALITY_ON_NUT' | 'HV_OUTSIDE_WASHER' | null {
  if (!q.group) return null;

  if (NUT_ONLY_GROUPS.includes(q.group) && name !== 'TUERCA') return 'NUT_ONLY_QUALITY_ON_NON_NUT';

  // The mirror case: a nut carrying a bolt grade (8.8 / 10.9 / 12.9). Rows 11 and 13 of the given
  // MTO plant exactly this. The rules do not state it, but the case statement puts "incoherence"
  // on the same footing as a missing mandatory field. Never rewrite 8.8 -> 8: different groups.
  if (name === 'TUERCA' && (['G5', 'G6', 'G7'] as QualityGroup[]).includes(q.group)) {
    return 'NON_NUT_QUALITY_ON_NUT';
  }

  if (opts.hvAppliesToWashersOnly && HARDNESS_GROUPS.includes(q.group) && name !== 'ARANDELA') {
    return 'HV_OUTSIDE_WASHER';
  }
  return null;
}

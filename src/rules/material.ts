/**
 * Material — reglas_tornilleria.md §4 and policy P-3.
 *
 * §4 is short: values are AC / INOX and other metallic materials; if neither appears, extract
 * whatever does. And a warning we must not lose: the MTO column literally named MATERIAL almost
 * never holds a material — it holds the quality (`8.8`, `A4-70`) or the standard with its grade
 * (`ASTM A193 GR B7`). The column name is not the attribute.
 *
 * 14 of the 15 given rows carry no material at all. Only row 14 writes `acero`.
 */

import { type Alias, type AliasHit, a, c, findAliases, lookupAlias } from './text.ts';
import { deriveMaterial, isDerived, type NoDerivation } from './vocabulary-db.ts';

export type Material = 'AC' | 'INOX';

export const MATERIAL_ALIASES: ReadonlyMap<Material, readonly Alias[]> = new Map<Material, Alias[]>([
  ['AC', [...c('ACERO', 'STEEL', 'AC'), ...a('ACERO AL CARBONO', 'CARBON STEEL', 'ACIER', 'ACO')]],
  // A2 / A4 / 304 / 316 are NOT here on purpose: §5 lists them as qualities (G1, G3). The material
  // comes from them through deriveMaterialFromQuality (P-3), never by treating them as a material.
  ['INOX', [...c('INOX'), ...a('ACERO INOXIDABLE', 'STAINLESS', 'STAINLESS STEEL', 'INOXIDABLE')]],
]);

export const findMaterials = (text: string): AliasHit<Material>[] => findAliases(text, MATERIAL_ALIASES);
export const normalizeMaterial = (raw: string): AliasHit<Material> | null => lookupAlias(raw, MATERIAL_ALIASES);

/**
 * Policy P-3: derive the material from the quality, against the closed table.
 *
 * Delegates to the SQLite vocabulary — see src/rules/vocabulary-db.ts for why the table lives in a
 * database rather than in this file. Kept as a thin wrapper so callers do not need to know where the
 * rules live.
 *
 * Returns the REASON when it does not derive, because the three reasons are different things and the
 * validator owes each a different outcome: uncovered is a policy gap, deliberate is a valid absence,
 * and ambiguous is a review — the table itself owes a disambiguation.
 */
export function deriveMaterialFromQuality(
  rawQuality: string,
): { material: Material; rule: string } | { material: null; why: NoDerivation } {
  const r = deriveMaterial(rawQuality);
  return isDerived(r) ? { material: r.material, rule: r.rule } : { material: null, why: r };
}

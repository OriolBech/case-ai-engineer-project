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
import { normalizeQuality } from './quality.ts';

export type Material = 'AC' | 'INOX';

export const MATERIAL_ALIASES: ReadonlyMap<Material, readonly Alias[]> = new Map<Material, Alias[]>([
  ['AC', [...c('ACERO', 'STEEL', 'AC'), ...a('ACERO AL CARBONO', 'CARBON STEEL', 'ACIER', 'ACO')]],
  ['INOX', [...c('INOX'), ...a('ACERO INOXIDABLE', 'STAINLESS', 'STAINLESS STEEL', 'INOXIDABLE', 'A2', 'A4')]],
]);

export const findMaterials = (text: string): AliasHit<Material>[] => findAliases(text, MATERIAL_ALIASES);
export const normalizeMaterial = (raw: string): AliasHit<Material> | null => lookupAlias(raw, MATERIAL_ALIASES);

/**
 * Policy P-3: derive the material from the quality when the MTO does not write it.
 *
 * Returns null when the quality carries no material information, so the caller can leave the
 * attribute empty rather than guess. The result is always tagged `provenance: 'derived'` upstream
 * — never 'extracted'. §1 forbids filling an absent attribute with the most likely value, so this
 * is deliberately a separate function from extraction, called only under P-3.
 */
export function deriveMaterialFromQuality(rawQuality: string): { material: Material; rule: string } | null {
  const q = normalizeQuality(rawQuality);

  if (q.group) {
    // Stainless groups: A2/A4 families.
    if (['G1', 'G2', 'G3', 'G4'].includes(q.group)) {
      return { material: 'INOX', rule: `P-3:${q.group}->INOX` };
    }
    // Property classes and nut classes are carbon steel.
    if (['G5', 'G6', 'G7', 'G8', 'G9'].includes(q.group)) {
      return { material: 'AC', rule: `P-3:${q.group}->AC` };
    }
    // Hardness groups (HV) say nothing about the base material. Do not guess.
    return null;
  }

  // Out-of-catalogue ASTM grades: B7 and 2H are alloy steel, not stainless.
  const f = rawQuality.toUpperCase().replace(/\s+/g, '');
  if (/^(GR)?B7M?$/.test(f) || /^(GR)?2HM?$/.test(f) || /^(GR)?B16$/.test(f)) {
    return { material: 'AC', rule: `P-3:ASTM_GRADE->AC` };
  }
  return null;
}

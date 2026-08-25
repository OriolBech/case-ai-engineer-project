/**
 * Quality equivalence table — reglas_tornilleria.md §5.
 *
 * Isolated from `quality.ts` on purpose. That file also consults layer 2 (`generic-alias-db`),
 * which opens `node:sqlite`. The buyer UI needs this Map in Client Components; pulling sqlite
 * into the browser bundle is the Turbopack panic on `/`. Same reason `vocab-model.ts` stays
 * Node-free.
 *
 * THE INVARIANT: two values of the same group are equivalent; values of different groups are
 * NOT. In particular `8.8` (G5) is not `8` (G8).
 */

import type { ClientQualityGroup, OwnQualityGroup, QualityGroup } from '../pipeline/types.ts';

/** Verbatim from §5's equivalence table. Layer 1: exactly fourteen, and it never grows from here. */
export const QUALITY_GROUPS: ReadonlyMap<ClientQualityGroup, readonly string[]> = new Map([
  ['G1', ['A2', 'A2-70', '18-8', '304']],
  ['G2', ['A2-80']],
  ['G3', ['A4', 'A4-70', '316']],
  ['G4', ['A4-80']],
  // §5's value list writes GRADE 5 / GRADE 8; its group table adds GRADO 5 / GRADO 8.
  // Both are kept — the group table is the operative one.
  ['G5', ['8.8', 'GRADE 5', 'GRADO 5']],
  ['G6', ['10.9', 'GRADE 8', 'GRADO 8']],
  ['G7', ['12.9']],
  ['G8', ['8']],
  ['G9', ['10']],
  ['G10', ['100HV']],
  ['G11', ['140HV']],
  ['G12', ['160HV']],
  ['G13', ['200HV']],
  ['G14', ['300HV']],
]);

/**
 * ¿Es un grupo nuestro y no del cliente?
 *
 * Se pregunta por el prefijo y no por "no está en los catorce": un id desconocido puede ser una
 * errata o un dato corrupto, y tratarlo como grupo propio lo convertiría en una equivalencia
 * inventada por accidente. El prefijo es una afirmación, la ausencia de la tabla no lo es.
 */
export function isOwnGroup(group: string): group is OwnQualityGroup {
  return group.startsWith('V-');
}

/** El id del grupo que nace de una calidad nueva. Legible en la traza: `V-GR-660`. */
export function ownGroupId(token: string): OwnQualityGroup {
  const slug = token
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'X';
  return `V-${slug}`;
}

/** Un grupo válido es uno de los catorce de §5, o uno nuestro bien formado. */
export function isKnownGroupShape(group: string): group is QualityGroup {
  return QUALITY_GROUPS.has(group as ClientQualityGroup) || (isOwnGroup(group) && group.length > 2);
}

/**
 * Finish catalogue — reglas_tornilleria.md §9.
 *
 * Two rules that are easy to lose: an absent finish is a VALID value and never sends a line to
 * review; and items with and without a finish are different materials, so a finish must never be
 * invented. Whether a row-level finish reaches the rest of a set is policy P-1, decided in the
 * validator — not here.
 */

import { type Alias, type AliasHit, a, c, findAliases, lookupAlias } from './text.ts';
import type { Finish } from '../pipeline/types.ts';

export const FINISH_ALIASES: ReadonlyMap<Finish, readonly Alias[]> = new Map<Finish, Alias[]>([
  ['GEOMET', [...c('GEOMET')]],
  ['DACROMET', [...c('DACROMET')]],
  [
    'GALVANIZADO EN CALIENTE',
    [
      ...c('GALVANIZADO EN CALIENTE', 'HOT DIP GALVANIZED', 'GALVA', 'HDG'),
      ...a('GALVANIZADA EN CALIENTE', 'HOT DIP GALV', 'GALVANIZED'),
    ],
  ],
  [
    'CINCADO',
    [
      ...c('CINCADO', 'ZINCADO', 'ZN', 'ZP', 'ZINC PLATED'),
      ...a('CINCADA', 'ZINCADA', 'ZINCADOS', 'ZINCADAS', 'ZINGUE', 'GALV ELECTROLITICO'),
    ],
  ],
  ['PAVONADO', [...c('PAVONADO', 'BL', 'NEGRO'), ...a('PAVONADA', 'BLACK', 'NOIR')]],
  ['FOSFATADO', [...c('FOSFATADO', 'PHOSPHATED'), ...a('FOSFATADA', 'PHOSPHATE')]],
  [
    'BICROMATADO',
    [...c('BICROMATADO', 'YZP', 'YELLOW ZINC PLATED'), ...a('BICROMATADA', 'ZINC AMARILLO')],
  ],
]);

/**
 * Finds finishes in free text.
 *
 * `ZN`, `ZP` and `BL` are two-letter aliases from the client's own table. findAliases matches on
 * word boundaries, so they cannot fire inside another word — the failure mode this guards against
 * is turning a random `BL` into PAVONADO and thereby changing which material gets bought.
 */
export const findFinishes = (text: string): AliasHit<Finish>[] => findAliases(text, FINISH_ALIASES);

export const normalizeFinish = (raw: string): AliasHit<Finish> | null => lookupAlias(raw, FINISH_ALIASES);

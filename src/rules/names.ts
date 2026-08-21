/**
 * Item name catalogue — reglas_tornilleria.md §3.
 *
 * The catalogue does not distinguish subtypes: an Allen screw and a hex screw are both
 * TORNILLO, a lock nut is TUERCA. What differentiates them is the standard.
 */

import { type Alias, type AliasHit, a, c, findAliases, lookupAlias } from './text.ts';
import type { ItemName } from '../pipeline/types.ts';

export const NAME_ALIASES: ReadonlyMap<ItemName, readonly Alias[]> = new Map<ItemName, Alias[]>([
  // Order within a value is irrelevant; findAliases matches longest-first globally so that
  // 'STUD BOLT' beats 'BOLT'.
  ['VARILLA ROSCADA', [...c('THREADED ROD', 'VARILLA ROSCADA'), ...a('BARRA ROSCADA', 'TIGE FILETEE')]],
  ['ESPARRAGO', [...c('STUD BOLT', 'STUD', 'ESPARRAGO'), ...a('ESPARRAGOS', 'PRISIONERO')]],
  [
    'TORNILLO',
    [
      ...c('SCREW', 'BOLT', 'TORNILLO'),
      // Inflections and other languages: engineering is partly subcontracted and each studio
      // writes differently. The table is the fast path; generalising to a language we did not
      // anticipate is the extractor's job (SPEC-003), not the table's.
      ...a('TORNILLOS', 'HEX BOLT', 'HEX HD BOLT', 'VIS', 'PARAFUSO', 'SCHRAUBE'),
    ],
  ],
  ['TUERCA', [...c('NUT', 'TUERCA'), ...a('TUERCAS', 'ECROU', 'PORCA', 'MUTTER')]],
  ['ARANDELA', [...c('WASHER', 'ARANDELA'), ...a('ARANDELAS', 'RONDELLE', 'ARRUELA', 'SCHEIBE')]],
]);

/** All name mentions in a row, in order of appearance. Feeds the deterministic split baseline. */
export const findNames = (text: string): AliasHit<ItemName>[] => findAliases(text, NAME_ALIASES);

/** Normalize a term the extractor already isolated. */
export const normalizeName = (raw: string): AliasHit<ItemName> | null => lookupAlias(raw, NAME_ALIASES);

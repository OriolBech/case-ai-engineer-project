/**
 * Finish catalogue — reglas_tornilleria.md §9.
 *
 * Two rules that are easy to lose: an absent finish is a VALID value and never sends a line to
 * review; and items with and without a finish are different materials, so a finish must never be
 * invented. Whether a row-level finish reaches the rest of a set is policy P-1, decided in the
 * validator — not here.
 *
 * La tabla vive en `finish-db.ts` (SPEC-011). Este fichero conserva los adaptadores que el pipeline
 * ya importaba.
 */

import { type AliasHit, type AliasSource } from './text.ts';
import type { Finish } from '../pipeline/types.ts';
import {
  findFinishes as findFinishesInDb,
  resolveFinish,
  aliasProvenance,
  FINISH_CATALOG,
  type FinishHit,
} from './finish-db.ts';

export { resolveFinish, FINISH_CATALOG, aliasProvenance };
export type { FinishResolution } from './finish-db.ts';

/** @deprecated Usar `listEntries()` de `finish-db.ts`. Conservado para compatibilidad de imports. */
export const FINISH_ALIASES: ReadonlyMap<Finish, readonly { text: string; source: AliasSource }[]> = new Map(
  FINISH_CATALOG.map((finish) => [
    finish,
    [] as { text: string; source: AliasSource }[],
  ]),
);

export const findFinishes = (text: string): AliasHit<Finish>[] =>
  findFinishesInDb(text).map((h: FinishHit) => ({
    value: h.finish,
    alias: h.alias,
    aliasSource: h.aliasSource,
    span: h.span,
  }));

export const normalizeFinish = (raw: string): AliasHit<Finish> | null => {
  const r = resolveFinish(raw);
  if (r.kind === 'known') {
    return {
      value: r.finish,
      alias: r.alias,
      aliasSource: r.aliasSource,
      span: { start: 0, end: raw.length },
    };
  }
  return null;
};

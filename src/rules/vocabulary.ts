/**
 * The vocabulary: rules the client's document does not contain, kept as DATA rather than code.
 *
 * This is the first concrete slice of what the client asked for on 2026-08-22 — "el sistema detrás
 * de las reglas, no solo las reglas". The material derivation used to be an `if` over group ids and
 * a regex over ASTM grades, both compiled into the binary. Three things were wrong with that:
 *
 *   - Adding a grade meant editing a regular expression and redeploying.
 *   - No entry recorded WHO decided it, WHEN, or on what grounds. The client cannot audit a .ts.
 *   - A quality no branch covered returned null and the line resolved with an EMPTY material, in
 *     silence. That is the default-fires-quietly failure the client pointed at.
 *
 * Now an uncovered quality produces a policy gap carrying the candidate entry, so the decision is
 * one line of JSON and it arrives with its provenance attached.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeQuality } from './quality.ts';

export interface VocabEntry {
  id: string;
  when: { qualityGroup?: string; qualityPattern?: string };
  material: 'AC' | 'INOX';
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  source: string;
}

export interface Vocabulary {
  version: number;
  attribute: string;
  policy: string;
  entries: VocabEntry[];
  deliberatelyUncovered: { match: string; why: string }[];
}

const DEFAULT_PATH = join('data', 'vocabulary', 'material-derivation.json');
let cached: Vocabulary | null = null;

/**
 * Loads the vocabulary from disk. Read once and memoised: it is data that changes between runs,
 * not within one, and a run has to be reproducible.
 */
export function materialVocabulary(path = process.env.VOCAB_MATERIAL ?? DEFAULT_PATH): Vocabulary {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(path, 'utf8')) as Vocabulary;
  return cached;
}

/** Test seam. */
export function resetVocabularyCache(): void { cached = null; }

export interface DerivationResult {
  material: 'AC' | 'INOX';
  /** Entry id, so the trace can say which decision produced the value and who took it. */
  entryId: string;
  rule: string;
}

/**
 * Derives the material from the quality using the vocabulary.
 *
 * Returns null when NO entry covers the quality. The caller must treat that as a gap, not as
 * "there is no material": the difference is the whole point of this module.
 */
export function deriveMaterial(rawQuality: string, vocab = materialVocabulary()): DerivationResult | null {
  const q = normalizeQuality(rawQuality);
  const folded = rawQuality.toUpperCase().replace(/\s+/g, ' ').trim();

  for (const e of vocab.entries) {
    if (e.when.qualityGroup && q.group === e.when.qualityGroup) {
      return { material: e.material, entryId: e.id, rule: `${vocab.policy}:${e.id}` };
    }
    if (e.when.qualityPattern && new RegExp(e.when.qualityPattern, 'i').test(folded)) {
      return { material: e.material, entryId: e.id, rule: `${vocab.policy}:${e.id}` };
    }
  }
  return null;
}

/** True when the vocabulary states on purpose that this quality carries no material information. */
export function isDeliberatelyUncovered(rawQuality: string, vocab = materialVocabulary()): boolean {
  const q = normalizeQuality(rawQuality);
  // The HV hardness groups: a 200HV washer can be steel or stainless, so deriving would be inventing.
  return q.group !== null && ['G10', 'G11', 'G12', 'G13', 'G14'].includes(q.group);
}

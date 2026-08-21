/**
 * Standards — reglas_tornilleria.md §8.
 *
 * The 25 DIN entries below are "not considered standards" by the client and normalize to their
 * ISO/EN equivalent. A DIN that is NOT in the table is preserved as-is: not all of them have an
 * equivalent. Once normalized, the standard is used with its exact structure.
 *
 * Coverage note: the given MTO exercises 6 of these 25, and only two of the six declared formats
 * (DIN, ASTM). See docs/09-coverage-and-blind-set.md.
 */

import { fold } from './text.ts';

/** Verbatim from §8. Keys are folded DIN designations. */
export const DIN_EQUIVALENCES: ReadonlyMap<string, string> = new Map([
  ['DIN 84', 'ISO 1207'],
  ['DIN 440', 'ISO 7094'],
  ['DIN 603', 'ISO 8677'],
  ['DIN 912', 'ISO 4762'],
  ['DIN 913', 'ISO 4026'],
  ['DIN 916', 'ISO 4029'],
  ['DIN 931', 'ISO 4014'],
  ['DIN 933', 'ISO 4017'],
  ['DIN 934', 'ISO 4032'],
  ['DIN 935', 'ISO 7035'],
  ['DIN 936', 'ISO 4035'],
  ['DIN 960', 'ISO 8765'],
  ['DIN 961', 'ISO 1665'],
  ['DIN 963', 'ISO 2009'],
  ['DIN 965', 'ISO 7046'],
  ['DIN 980', 'ISO 7042'],
  ['DIN 982', 'ISO 7040'],
  ['DIN 985', 'ISO 10511'],
  ['DIN 6923', 'EN 1661'],
  ['DIN 7981 C-H', 'ISO 7049'],
  ['DIN 7982 C-H', 'ISO 7050'],
  ['DIN 7985', 'ISO 7045'],
  ['DIN 7991', 'ISO 10642'],
  ['DIN 9021', 'ISO 7093'],
  ['DIN 125', 'ISO 7089'],
  ['DIN 125 A', 'ISO 7089'],
]);

export type StandardFamily = 'DIN' | 'DIN EN' | 'ISO' | 'EN' | 'ASME' | 'ASTM' | 'MSS SP';

export interface StandardResult {
  raw: string;
  /** Canonical designation after the §8 table, or the canonical raw form if there is no entry. */
  normalized: string;
  family: StandardFamily;
  /** true when the §8 equivalence table was applied. Feeds the trace shown in the challenge. */
  mapped: boolean;
  /** e.g. 'DIN934->ISO4032', or null when preserved as written. */
  rule: string | null;
}

/**
 * Ordered patterns. `DIN EN` must be tried before `DIN`, and `MSS SP` before anything that could
 * swallow `SP`. The optional trailing group captures the suffix variants the table needs:
 * `DIN 125 A` and `DIN 7981 C-H`.
 */
const PATTERNS: { family: StandardFamily; re: RegExp; canon: (m: RegExpMatchArray) => string }[] = [
  {
    family: 'DIN EN',
    re: /\bDIN\s*EN\s*([0-9]+(?:-[0-9]+)?)\b/,
    canon: (m) => `DIN EN ${m[1]}`,
  },
  {
    family: 'MSS SP',
    re: /\bMSS\s*SP\s*[- ]\s*([0-9]+)\b/,
    canon: (m) => `MSS SP-${m[1]}`,
  },
  {
    family: 'DIN',
    re: /\bDIN\s*([0-9]+)(?:\s+([A-Z](?:\s*-\s*[A-Z])?))?\b/,
    canon: (m) => (m[2] ? `DIN ${m[1]} ${m[2].replace(/\s*-\s*/, '-')}` : `DIN ${m[1]}`),
  },
  { family: 'ISO', re: /\bISO\s*([0-9]+)\b/, canon: (m) => `ISO ${m[1]}` },
  { family: 'ASTM', re: /\bASTM\s*([A-Z]\s*[0-9]+)\b/, canon: (m) => `ASTM ${m[1].replace(/\s+/g, '')}` },
  { family: 'ASME', re: /\bASME\s*(B\s*[0-9]+(?:\.[0-9]+)*[A-Z]?)\b/, canon: (m) => `ASME ${m[1].replace(/\s+/g, '')}` },
  { family: 'EN', re: /\bEN\s*([0-9]+)\b/, canon: (m) => `EN ${m[1]}` },
];

/** Normalizes a designation the extractor already isolated. */
export function normalizeStandard(raw: string): StandardResult | null {
  const folded = fold(raw);
  for (const { family, re, canon } of PATTERNS) {
    const m = folded.match(re);
    if (!m) continue;
    const canonical = canon(m);
    // Longest key first so 'DIN 125 A' wins over 'DIN 125'.
    const key = DIN_EQUIVALENCES.has(canonical) ? canonical : null;
    if (key) {
      const target = DIN_EQUIVALENCES.get(key)!;
      return {
        raw,
        normalized: target,
        family: target.startsWith('EN') ? 'EN' : 'ISO',
        mapped: true,
        rule: `${canonical.replace(/\s+/g, '')}->${target.replace(/\s+/g, '')}`,
      };
    }
    return { raw, normalized: canonical, family, mapped: false, rule: null };
  }
  return null;
}

/** All standards in a row, in order. Feeds the deterministic baseline and the set splitter. */
export function findStandards(text: string): { result: StandardResult; span: { start: number; end: number } }[] {
  const folded = fold(text);
  const out: { result: StandardResult; span: { start: number; end: number } }[] = [];
  const claimed: boolean[] = new Array(folded.length).fill(false);

  for (const { re } of PATTERNS) {
    const g = new RegExp(re.source, 'g');
    for (let m = g.exec(folded); m; m = g.exec(folded)) {
      const start = m.index;
      const end = start + m[0].length;
      let free = true;
      for (let i = start; i < end; i++) if (claimed[i]) { free = false; break; }
      if (!free) continue;
      const result = normalizeStandard(m[0]);
      if (!result) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      out.push({ result, span: { start, end } });
    }
  }
  return out.sort((x, y) => x.span.start - y.span.start);
}

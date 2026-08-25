/**
 * Turns the model's literal evidence strings into offsets in MtoRow.sourceText.
 *
 * We never ask the model for character offsets — models are unreliable at arithmetic over text and
 * a wrong offset produces a trace that points at the wrong words, which is worse than no trace.
 * Instead the model returns the literal substring it relied on, and we locate it ourselves. That
 * gives two things for free:
 *
 *   - Exact, verifiable spans for the trace panel the challenge asks for.
 *   - A hallucination detector: evidence that is not present in the row did not come from the row.
 */

import type { Span } from './types.ts';
import { fold } from '../rules/text.ts';

export interface Located {
  span: Span | null;
  /** true when the evidence string could not be found in the source at all. */
  hallucinated: boolean;
}

/**
 * Locates `evidence` in `source`, preferring an exact match, then a diacritic/case-folded match,
 * then a whitespace-insensitive match. `from` lets the caller scan left-to-right so repeated
 * substrings (three `7/8"` in row 1) map to distinct occurrences instead of all to the first.
 */
export function locate(source: string, evidence: string | null, from = 0): Located {
  if (evidence === null) return { span: null, hallucinated: false };
  const needle = unescapeJsonish(evidence.trim());
  if (needle === '') return { span: null, hallucinated: false };

  const exact = source.indexOf(needle, from);
  if (exact >= 0) return { span: { start: exact, end: exact + needle.length }, hallucinated: false };
  const exactAny = source.indexOf(needle);
  if (exactAny >= 0) return { span: { start: exactAny, end: exactAny + needle.length }, hallucinated: false };

  // Folded comparison: fold() preserves length for case and combining-mark stripping, so indices
  // in the folded string map back to the original.
  const fs = fold(source);
  const fn = fold(needle);
  if (fs.length === source.length) {
    const i = fs.indexOf(fn, from) >= 0 ? fs.indexOf(fn, from) : fs.indexOf(fn);
    if (i >= 0) return { span: { start: i, end: i + fn.length }, hallucinated: false };
  }

  // Last resort: ignore whitespace differences (`DIN 931` vs `DIN931`).
  const loose = findIgnoringWhitespace(source, needle);
  if (loose) return { span: loose, hallucinated: false };

  return { span: null, hallucinated: true };
}

/**
 * Undoes literal backslash escaping in the model's evidence.
 *
 * Fastener sizes carry an inch mark — `7/8"` — and a provider returned the evidence with the quote
 * still backslash-escaped, so the string never matched the source, the element was written off as a
 * hallucination, and the row produced NO LINES AT ALL. A silently vanished row is a material nobody
 * buys, which is the one outcome this pipeline must never produce.
 */
/**
 * Undoes one layer of JSON escaping the model left in a string it returned.
 *
 * EXPORTED because the value needs it as much as the evidence does, and for a while only the
 * evidence got it. A model that answers `1\"` for the measure of `STUD BOLT 1" X 150 LG` was
 * located correctly in the row — `locate` unescapes before searching — and then the **value** was
 * adopted verbatim, so the line shipped a measure with a literal backslash in it. It resolved, so
 * the harness counted it as a SILENT ERROR: the worst class, a wrong size on a line nobody is going
 * to look at. Intermittent, because the double escaping is the model's whim: one pass in six.
 */
export function unescapeJsonish(s: string): string {
  if (!s.includes('\\')) return s;
  return s.replace(/\\(["'\\nrt])/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c);
}

function findIgnoringWhitespace(source: string, needle: string): Span | null {
  const target = fold(needle).replace(/\s+/g, '');
  if (target === '') return null;
  const upper = fold(source);
  for (let start = 0; start < upper.length; start++) {
    let acc = '';
    for (let end = start; end < upper.length && acc.length <= target.length; end++) {
      const ch = upper[end];
      if (!/\s/.test(ch)) acc += ch;
      if (acc === target) return { start, end: end + 1 };
      if (!target.startsWith(acc)) break;
    }
  }
  return null;
}

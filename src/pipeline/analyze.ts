/**
 * Stages 2+3 — set segmentation and attribute extraction, in one call per row.
 * See specs/SPEC-002-set-splitter.md and specs/SPEC-003-attribute-extractor.md.
 *
 * WHY ONE AGENT AND NOT TWO. The specs describe them separately, and the implementation merges
 * them, deliberately: deciding that a row contains three materials and deciding that
 * `ASTM A194, GR 2H` belongs to the nut rather than to the stud is the same act of reading. Split
 * across two calls, the extractor has to re-read the whole row anyway to place attributes, so we
 * would pay ~3x the calls (one per element instead of one per row) for the same judgement, and we
 * would add a failure mode: a bad decomposition the second stage cannot revise.
 *
 * What we keep from having two specs is the ability to ablate: the deterministic baseline in
 * src/rules (findNames / findStandards / findFinishes) plays the role of "split without a model",
 * and the critic (SPEC-006) checks the decomposition afterwards. If the joint call turns out to
 * misplace attributes, splitting it back into two stages is the first thing to try, and the eval
 * harness will say so.
 */

import type { Llm } from '../lib/llm.ts';
import { LlmError } from '../lib/llm.ts';
import type { MtoRow, Span } from './types.ts';
import { ANALYZE_SCHEMA, ANALYZE_SYSTEM, analyzeUser } from './prompts.ts';
import { locate, unescapeJsonish } from './spans.ts';
import { findNames } from '../rules/names.ts';
import { findStandards } from '../rules/standards.ts';

interface RawAttr { value: string | null; evidence: string | null }

interface RawElement {
  detectedName: string;
  normalizedName: string | null;
  role: 'principal' | 'secondary';
  evidence: string;
  multiplicity: number;
  multiplicityStated: boolean;
  multiplicityEvidence: string | null;
  attributes: Record<AnalyzedAttrKey, RawAttr>;
}

interface RawAnalysis {
  outOfFamily: boolean;
  outOfFamilyReason: string | null;
  elements: RawElement[];
}

export type AnalyzedAttrKey = 'material' | 'quality' | 'measure' | 'length' | 'standard' | 'finish';
export const ANALYZED_ATTR_KEYS: readonly AnalyzedAttrKey[] = [
  'material', 'quality', 'measure', 'length', 'standard', 'finish',
];

export interface AnalyzedValue {
  value: string | null;
  span: Span | null;
  /** Evidence the model gave that does not exist in the row. The value is discarded. */
  hallucinated: boolean;
}

/** A multiplicity the model claimed as written and the row does not justify. See `checkMultiplicity`. */
export interface RejectedMultiplicity {
  element: string;
  claimed: number;
  evidence: string | null;
  reason: 'not_in_description' | 'row_says_other';
}

export interface AnalyzedElement {
  detectedName: string;
  normalizedName: string | null;
  role: 'principal' | 'secondary';
  span: Span | null;
  multiplicity: number;
  multiplicityStated: boolean;
  attributes: Record<AnalyzedAttrKey, AnalyzedValue>;
}

/**
 * How to pick the model for a row.
 *
 * 'mixed' is the interesting one: the risk that needs the strong model is ATTRIBUTION — putting
 * `ASTM A194, GR 2H` on the nut instead of the stud — and that risk only exists when a row
 * describes more than one material. Single-element rows have nowhere to misattribute to.
 */
export type ModelRouting = 'always_main' | 'always_cheap' | 'mixed';

/**
 * The router is deterministic and free: it counts distinct catalogue names with the same tables
 * that provide the no-model baseline. No call is made to decide which model to call.
 *
 * Its one failure mode is a set written so that only one name is recognisable. That is covered by
 * escalation below rather than by making the router cleverer.
 */
export function routeRow(row: MtoRow): 'main' | 'cheap' {
  const distinct = new Set(findNames(row.sourceText).map((h) => h.value));
  return distinct.size >= 2 ? 'main' : 'cheap';
}

export interface Analysis {
  rowRef: string;
  outOfFamily: boolean;
  outOfFamilyReason: string | null;
  elements: AnalyzedElement[];
  /** Counted, never silent: it is the honest denominator for "does the model invent things". */
  hallucinations: { element: string; attribute: string; evidence: string }[];
  /** Stated multiplicities the row does not justify. Demoted to 1, never applied. */
  rejectedMultiplicity: RejectedMultiplicity[];
  /** True when no model was called: empty row, short-circuited deterministically. */
  skippedLlm: boolean;
  /** Which tier actually produced this analysis. */
  tier: 'main' | 'cheap' | 'none';
  /** True when the cheap tier found a set the router had judged single-element, so we re-ran. */
  escalated: boolean;
  /**
   * Set when the model call failed for this row. The row is reported, never dropped and never
   * silently emptied: an empty elements list would look like "nothing to buy here".
   */
  error: { kind: string; message: string } | null;
}

/**
 * Verifies every value the model returned against the source text.
 *
 * A value whose evidence is not in the row is dropped, not kept with a null span. Keeping it would
 * mean carrying a fabricated attribute into a purchase order with no way to trace it back — the
 * exact failure the case statement describes as buying the wrong material with a machine's
 * confidence.
 */
export type { RawAnalysis };

/**
 * The multiplicity, decided by the row and not by the model.
 *
 * It is the only number the extractor returns that MULTIPLIES the purchase order, and it was the
 * only value travelling unverified. `gpt-5.4-mini` read the row's QUANTITY column as the
 * multiplicity of the principal element on two rows: 100 bolts became 10.000, 50 became 2.500. Both
 * lines came out RESUELTA and the harness scored them perfect, because quantity was not being
 * graded (fixed in src/eval/harness.ts).
 *
 * The first attempt asked the model for evidence and checked it. That was still the wrong boundary,
 * and the frozen critic baseline proved it: recorded before the evidence field existed, every stated
 * multiplicity in it failed the check and 80 nuts silently became 40. A guard that turns missing
 * metadata into a wrong number is worse than the hole it closed.
 *
 * So the row decides. A multiplicity is a small number written immediately before the element's own
 * name — `W/2 HEX. NUT`, `2 WASHER`, `2 tuercas`, `2 arandelas` — and finding it is a regex, not a
 * judgement. Same boundary as findNames over the model's classification, and as the length inside an
 * ISO designation: where a closed rule can decide, the model does not get a vote.
 *
 * Two things this must never do, both of them real failure shapes:
 *
 *   - cross a cell boundary. `1 | STUD BOLT ...` would make the ITEM number a multiplicity, and the
 *     quantity column would make it the order size — the original bug, arrived at from the other
 *     side. Any `|` between the number and the name disqualifies it.
 *   - invent. No number before the name means multiplicity 1, `stated: false`, which hands the case
 *     to policy P-2 instead of to arithmetic.
 *
 * The model's own claim is kept only to report the discrepancy: what it said, what the row says.
 */
/**
 * Words that may sit between a count and the element name it counts: `W/2 HEX. NUT`, `2 arandelas
 * planas`. A closed list, because anything wider swallows a standard number — see below.
 */
const QUALIFIERS = new Set([
  'HEX', 'HEXAGONAL', 'HEXAGONALES', 'PLANA', 'PLANAS', 'PLANO', 'PLANOS',
  'AUTOBLOCANTE', 'AUTOBLOCANTES', 'ALLEN', 'CILINDRICO', 'CILINDRICOS',
  'FLAT', 'LOCK', 'SPRING', 'HEAVY', 'HVY', 'HEX.',
]);

/**
 * Tokens that INTRODUCE a count. This is the check that makes the scan safe.
 *
 * `NUT DIN 934 and WASHER DIN 125` is the trap: read backwards from `WASHER`, the nearest number is
 * the 934 of a standard, and a scan that accepts any number would order 934 washers. What separates
 * a count from a standard's number is not the distance — it is that a count is introduced:
 * `W/2`, `con 2`, `y 2`, `AND 4`, `, 2`. A number introduced by `DIN` is not a count.
 */
const CONNECTORS = new Set(['W', 'C/W', 'CW', 'CON', 'CONJUNTO', 'WITH', 'AND', 'Y', 'MAS', 'PLUS']);

/** Characters that may sit between the pieces: whitespace and the punctuation MTOs use. */
const GAP = /[\s,;:./+()-]/;

/** Folds a token for comparison against the closed lists: no diacritics, upper case. */
const foldToken = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** How much text before the element name can hold its count. Wide enough for `W/2 HEX. `, no wider. */
const MULTIPLICITY_WINDOW = 26;

/**
 * The count the row writes for an element, or null.
 *
 * Written out rather than crammed into a regex because the shapes that must NOT match sit one
 * character or one word away from the ones that must:
 *
 *   W/2 HEX. NUT            -> 2      the commonest form in this MTO; slash is notation, HEX. a qualifier
 *   , 2 WASHER 7/8"         -> 2
 *   con 2 tuercas DIN 934   -> 2
 *   y 2 arandelas           -> 2
 *   W/ 2 NUT                -> 2
 *   with NUT                -> null   no count written: policy P-2 decides, not arithmetic
 *   NUT DIN 934 and WASHER  -> null   934 is a STANDARD. Nothing introduces it as a count
 *   7/8" WASHER             -> null   a fraction. Same slash as W/2, digit in front of it
 *   M12 tuercas             -> null   a measure. Same digits, letter glued in front
 *   1 | STUD BOLT           -> null   a cell boundary: that 1 is the ITEM column
 *
 * Two earlier versions of this got it wrong in both directions, and both are in the tests: one
 * excluded `/` outright to keep fractions out and silently discarded every `W/2` in the file; the
 * next allowed any word between count and name, which turns `DIN 934 and WASHER` into 934 washers.
 */
export function findMultiplicity(sourceText: string, elementStart: number): { value: number; evidence: string } | null {
  const from = Math.max(0, elementStart - MULTIPLICITY_WINDOW);
  const before = sourceText.slice(from, elementStart);
  if (before.trimEnd().endsWith('|')) return null;

  let i = before.length;
  const eatGap = (): void => { while (i > 0 && GAP.test(before[i - 1])) i--; };
  const wordAt = (): { text: string; start: number } => {
    let j = i;
    while (j > 0 && /[A-Za-zÀ-ÿ.]/.test(before[j - 1])) j--;
    return { text: before.slice(j, i), start: j };
  };

  // Walk back: gap, then at most two qualifier words, looking for the digits.
  for (let hop = 0; hop <= 2; hop++) {
    eatGap();
    if (i === 0) return null;
    if (/\d/.test(before[i - 1])) break;
    const w = wordAt();
    if (w.text === '' || !QUALIFIERS.has(foldToken(w.text))) return null;
    i = w.start;
  }
  if (i === 0 || !/\d/.test(before[i - 1])) return null;

  const end = i;
  while (i > 0 && /\d/.test(before[i - 1])) i--;
  // A letter or a decimal mark glued to the digits means this is a designation, not a count.
  if (i > 0 && /[A-Za-zÀ-ÿ.,]/.test(before[i - 1])) return null;
  if (before.slice(i).includes('|')) return null;

  // The count must be INTRODUCED: by punctuation, by a connector word, or by the start of the cell.
  // Without this check the nearest number wins, and in `NUT DIN 934 and WASHER` that number is a
  // standard.
  let k = i;
  while (k > 0 && GAP.test(before[k - 1]) && before[k - 1] !== '/') k--;
  const gapText = before.slice(k, i);
  if (!/[,;:(+]/.test(gapText)) {
    if (k > 0 && before[k - 1] === '/') {
      k--; // `W/2`: the slash belongs to the connector, and a digit before it would be a fraction
      if (k > 0 && /\d/.test(before[k - 1])) return null;
    }
    let j = k;
    while (j > 0 && /[A-Za-zÀ-ÿ/]/.test(before[j - 1])) j--;
    const intro = before.slice(j, k);
    const atCellStart = j === 0 && from === 0;
    if (!(atCellStart || CONNECTORS.has(foldToken(intro)))) return null;
  }

  const n = Number(before.slice(i, end));
  // `>= 1`, not `>= 2`. A written `1` is not the absence of a count: `1 WASHER ASTM F436` on row 5
  // says one washer per set, and rejecting it filed the row's own words under P-2 as if the row had
  // said nothing. The number does not move — quantity x 1 is quantity — but the trace did: the cell
  // read `inferido`, carried the "careful, this was assumed" mark in the queue, and disagreed with
  // the gold set, which records it as `extracted`.
  //
  // Safe because the introduction guard above is what does the real work: a `1` still has to be
  // introduced by punctuation, by a connector, or by the start of the cell, so `M10 x 1 TUERCA` and
  // `1 | STUD BOLT` are rejected exactly as before. And the blast radius of a wrong accept is a
  // provenance label, never a wrong order — which is the opposite of the `>= 2` case, where a wrong
  // accept multiplies the purchase.
  if (!Number.isFinite(n) || n < 1) return null;
  return { value: n, evidence: before.slice(i).trim() };
}

/** First catalogue name the tables recognise inside `span`, which is where the count must stop. */
function nameStartIn(names: ReturnType<typeof findNames>, span: Span | null): number | null {
  if (!span) return null;
  const inside = names
    .filter((n) => n.span.start >= span.start && n.span.start < span.end)
    .sort((a, b) => a.span.start - b.span.start);
  return inside.length ? inside[0].span.start : null;
}

function checkMultiplicity(
  el: RawElement,
  row: MtoRow,
  nameStart: number | null,
): { multiplicity: number; stated: boolean; rejected: RejectedMultiplicity | null } {
  const claimed = Math.max(1, Math.trunc(el.multiplicity || 1));
  const found = nameStart === null ? null : findMultiplicity(row.sourceText, nameStart);

  if (found) {
    return {
      multiplicity: found.value,
      stated: true,
      // Reported, not obeyed: the row won, and the disagreement is worth seeing.
      rejected: claimed === found.value ? null
        : { element: el.detectedName, claimed, evidence: found.evidence, reason: 'row_says_other' },
    };
  }
  return {
    multiplicity: 1,
    stated: false,
    rejected: claimed === 1 ? null
      : { element: el.detectedName, claimed, evidence: null, reason: 'not_in_description' },
  };
}

/**
 * Builds an Analysis from a model response that was recorded earlier instead of called now.
 *
 * Exported for one reason: measuring the critic (SPEC-006) requires a model output with KNOWN
 * errors in it, and the one we have is `gpt-5.4-mini`'s — a model we can no longer call, and whose
 * only copy lived in a disk cache that any prompt change or cold start destroys. Frozen in
 * `data/eval/critic-baseline-gpt-5.4-mini.json`, the critic's recall and precision stay
 * reproducible at zero cost and without the provider that produced the input.
 */
export function analysisFromResponse(raw: RawAnalysis, row: MtoRow): Analysis {
  return verify(raw, row);
}

/**
 * Defensive on purpose, like the critic's parser. A strict JSON Schema is enforced by the provider,
 * and not every provider honours it — least of all an open-weight model behind OpenRouter. Two real
 * failures on the synthetic set, both fatal for the row before this guard:
 *
 *   - a response with no `elements` at all: `for (const el of raw.elements)` threw
 *     "raw.elements is not iterable";
 *   - an element with no `evidence` string: `evidence.trim()` inside locate() threw
 *     "Cannot read properties of undefined".
 *
 * Both landed as PROCESSING_FAILED, so no row disappeared — the invariant held. But a row lost to a
 * malformed field is a row nobody extracts, and it costs a retry of the whole file. An unreadable
 * element is skipped and counted; an unreadable response degrades to zero elements, which the
 * validator already reports as NO_ELEMENTS_EXTRACTED.
 */
function readableElements(raw: RawAnalysis): RawElement[] {
  if (!Array.isArray(raw?.elements)) return [];
  return raw.elements.filter((el) => el && typeof el.evidence === 'string' && typeof el.detectedName === 'string');
}

function verify(raw: RawAnalysis, row: MtoRow): Analysis {
  const hallucinations: Analysis['hallucinations'] = [];
  const rejectedMultiplicity: RejectedMultiplicity[] = [];
  const elements: AnalyzedElement[] = [];
  let cursor = 0;

  const rowNames = findNames(row.sourceText);
  const readable = readableElements(raw);
  const unreadable = (Array.isArray(raw?.elements) ? raw.elements.length : 0) - readable.length;
  for (let i = 0; i < unreadable; i++) {
    hallucinations.push({ element: '(ilegible)', attribute: '(elemento sin evidencia)', evidence: '' });
  }

  for (const el of readable) {
    const elLoc = locate(row.sourceText, el.evidence, cursor);
    if (elLoc.hallucinated) {
      hallucinations.push({ element: el.detectedName, attribute: '(elemento)', evidence: el.evidence });
      continue; // An element we cannot find in the row is not in the row.
    }
    if (elLoc.span) cursor = elLoc.span.start;

    const attributes = {} as Record<AnalyzedAttrKey, AnalyzedValue>;
    for (const key of ANALYZED_ATTR_KEYS) {
      const rawAttr = el.attributes?.[key];
      // `unescapeJsonish` on the VALUE, not only on the evidence. `locate` already unescapes what
      // it searches for, so a doubly-escaped `1\"` was found in the row and then stored with the
      // backslash still in it. Same string, two boundaries, one of them missing — see spans.ts.
      const a: RawAttr = {
        value: typeof rawAttr?.value === 'string' ? unescapeJsonish(rawAttr.value) : null,
        evidence: typeof rawAttr?.evidence === 'string' ? rawAttr.evidence : null,
      };
      if (a.value === null) { attributes[key] = { value: null, span: null, hallucinated: false }; continue; }
      const loc = locate(row.sourceText, a.evidence ?? a.value, elLoc.span?.start ?? 0);
      if (loc.hallucinated) {
        hallucinations.push({ element: el.detectedName, attribute: key, evidence: a.evidence ?? a.value });
        attributes[key] = { value: null, span: null, hallucinated: true };
      } else {
        attributes[key] = { value: a.value, span: loc.span, hallucinated: false };
      }
    }

    // The count is anchored to the element's NAME, not to the start of its evidence. The two are
    // not the same place and the difference is the whole feature: the model returns `W/2 HEX. NUT`
    // as its evidence, so the count sits INSIDE the span, and a scan that looks only before the
    // span start finds nothing. Every real multiplicity in the MTO was being rejected that way.
    //
    // The name's position comes from the same table that decides the name (findNames), so the
    // anchor does not depend on where the model chose to begin quoting.
    const mult = checkMultiplicity(el, row, nameStartIn(rowNames, elLoc.span) ?? elLoc.span?.start ?? null);
    if (mult.rejected) rejectedMultiplicity.push(mult.rejected);

    elements.push({
      detectedName: el.detectedName,
      normalizedName: el.normalizedName,
      role: el.role,
      span: elLoc.span,
      multiplicity: mult.multiplicity,
      multiplicityStated: mult.stated,
      attributes,
    });
  }

  // El modelo no tiene la última palabra sobre "esto no es tornillería" cuando la TABLA reconoce un
  // nombre del catálogo en la fila.
  //
  // Caso real, variante v09: sobre `Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado` devolvió
  // outOfFamily=true, "Fila no describe tornillería". La misma fila acierta en las otras nueve
  // variantes, así que es una tirada mala del modelo — y es la peor clase de tirada mala, porque una
  // fila declarada fuera de familia se va a la cola de "esto no es mío" y desaparece del circuito de
  // compra. No produce una compra equivocada; produce un material que nadie pide.
  //
  // P-9 dice "nunca fuerces una brida a ser un TORNILLO". Faltaba lo simétrico: nunca aceptes "no es
  // tornillería" sobre una fila donde `findNames` encuentra uno de los cinco nombres. Es la cuarta vez
  // en este pipeline que la frontera correcta es la misma — donde puede decidir una regla cerrada, el
  // modelo no vota — y aquí la regla es más fiable que el modelo por construcción: el catálogo es
  // cerrado y el alias más largo gana.
  //
  // Al desactivarlo la fila se queda sin elementos, así que sale como NO_ELEMENTS_EXTRACTED: una
  // revisión con motivo, en la cola correcta. Nunca en silencio.
  const nameInRow = rowNames.length > 0 ? rowNames[0].value : null;
  const contradicted = raw.outOfFamily === true && nameInRow !== null;
  if (contradicted) {
    hallucinations.push({
      element: '(fila)',
      attribute: '(fuera de familia contradicho por la tabla)',
      evidence: `el modelo dijo "no es tornillería" y la tabla reconoce ${nameInRow}`,
    });
  }

  return {
    rowRef: row.itemRef,
    outOfFamily: contradicted ? false : raw.outOfFamily,
    outOfFamilyReason: contradicted ? null : raw.outOfFamilyReason,
    elements,
    hallucinations,
    rejectedMultiplicity,
    skippedLlm: false,
    tier: 'main',
    escalated: false,
    error: null,
  };
}

/**
 * Rows with no usable description never reach the model: no text, no elements, no cost.
 *
 * The gate uses the deterministic tables rather than a length heuristic. Two attempts failed
 * first, and both are worth recording:
 *
 *   - Counting letters: a row whose only text is the unit column (`50 | uds`) has three letters and
 *     looked describable, so it reached the model and came back flagged as "not a fastener" — true
 *     but misleading. The problem is that nothing was read, not that something was misread.
 *   - Requiring tokens of four letters or more: this dropped `NUT DIN 934, A4-80`, because every
 *     token in it is three letters or fewer. English names are short.
 *
 * A recognisable name or standard means there is something to extract. Neither, plus almost no
 * text, means the row is empty — and it costs nothing to find out.
 */
function isEmptyDescription(row: MtoRow): boolean {
  if (findNames(row.sourceText).length > 0) return false;
  if (findStandards(row.sourceText).length > 0) return false;
  return row.sourceText.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 8;
}

export interface AnalyzeOptions { routing?: ModelRouting }

export async function analyzeRow(llm: Llm, row: MtoRow, opts: AnalyzeOptions = {}): Promise<Analysis> {
  if (isEmptyDescription(row)) {
    return {
      rowRef: row.itemRef,
      outOfFamily: false,
      outOfFamilyReason: null,
      elements: [],
      hallucinations: [],
      rejectedMultiplicity: [],
      skippedLlm: true,
      tier: 'none',
      escalated: false,
      error: null,
    };
  }

  const call = async (tier: 'main' | 'cheap'): Promise<Analysis> => {
    const { data } = await llm.complete<RawAnalysis>({
      system: ANALYZE_SYSTEM,
      user: analyzeUser(row.sourceText, row.itemRef, row.cellOffsets),
      schema: ANALYZE_SCHEMA,
      schemaName: 'mto_row_analysis',
      maxTokens: 8192,
      tier,
      // An empty `elements` array is a valid answer ("no materials in this row", reported as
      // NO_ELEMENTS_EXTRACTED). A MISSING `elements` field is not an answer at all.
      validate: (d) => Array.isArray((d as RawAnalysis | null)?.elements),
    });
    return { ...verify(data, row), tier, error: null };
  };

  const routing = opts.routing ?? 'always_main';
  try {
    if (routing === 'always_main') return await call('main');
    if (routing === 'always_cheap') return await call('cheap');
    return await mixed();
  } catch (e) {
    // One row failing must not take the run with it. A terminal quota or auth error still stops
    // everything (see analyzeRows), because continuing would produce 500 identical failures.
    return {
      rowRef: row.itemRef,
      outOfFamily: false,
      outOfFamilyReason: null,
      elements: [],
      hallucinations: [],
      rejectedMultiplicity: [],
      skippedLlm: false,
      tier: 'none',
      escalated: false,
      error: {
        kind: e instanceof LlmError ? e.kind : 'unknown',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  async function mixed(): Promise<Analysis> {
  const planned = routeRow(row);
  if (planned === 'main') return call('main');

  const cheap = await call('cheap');
  // The router said one material and the cheap model found a set: attribution risk is real after
  // all, so pay for the strong model. Rare by construction, and far cheaper than the alternative
  // of routing every row to the strong model just in case.
  if (cheap.elements.length > 1) return { ...(await call('main')), escalated: true };
  return cheap;
  }
}

/** Runs rows with bounded concurrency: enough to be fast, low enough not to hit rate limits. */
export async function analyzeRows(
  llm: Llm,
  rows: MtoRow[],
  opts: { concurrency?: number; routing?: ModelRouting; onRow?: (a: Analysis) => void } = {},
): Promise<Analysis[]> {
  const limit = opts.concurrency ?? 12;
  const out: Analysis[] = new Array(rows.length);
  let next = 0;

  let fatal: Error | null = null;

  async function worker(): Promise<void> {
    for (;;) {
      if (fatal) return;
      const i = next++;
      if (i >= rows.length) return;
      out[i] = await analyzeRow(llm, rows[i], { routing: opts.routing });
      // Quota and auth will fail identically for every remaining row. Failing fast beats emitting
      // hundreds of identical errors and burning the wall clock of a live demo.
      if (out[i].error && (out[i].error!.kind === 'quota' || out[i].error!.kind === 'auth')) {
        fatal = new Error(out[i].error!.message);
      }
      opts.onRow?.(out[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, worker));
  if (fatal) throw fatal;
  // NOT filtered: index i must keep matching rows[i] downstream. A `filter(Boolean)` here would
  // shift every analysis onto the wrong row the first time a slot was empty — a silent
  // misalignment, which is worse than the hole it was trying to hide. Holes cannot survive anyway:
  // a fatal error throws, and every other failure fills the slot with an error analysis.
  return out;
}

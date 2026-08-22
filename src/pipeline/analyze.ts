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
import { locate } from './spans.ts';
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
function verify(raw: RawAnalysis, row: MtoRow): Analysis {
  const hallucinations: Analysis['hallucinations'] = [];
  const elements: AnalyzedElement[] = [];
  let cursor = 0;

  for (const el of raw.elements) {
    const elLoc = locate(row.sourceText, el.evidence, cursor);
    if (elLoc.hallucinated) {
      hallucinations.push({ element: el.detectedName, attribute: '(elemento)', evidence: el.evidence });
      continue; // An element we cannot find in the row is not in the row.
    }
    if (elLoc.span) cursor = elLoc.span.start;

    const attributes = {} as Record<AnalyzedAttrKey, AnalyzedValue>;
    for (const key of ANALYZED_ATTR_KEYS) {
      const a = el.attributes[key] ?? { value: null, evidence: null };
      if (a.value === null) { attributes[key] = { value: null, span: null, hallucinated: false }; continue; }
      const loc = locate(row.sourceText, a.evidence ?? a.value, elLoc.span?.start ?? 0);
      if (loc.hallucinated) {
        hallucinations.push({ element: el.detectedName, attribute: key, evidence: a.evidence ?? a.value });
        attributes[key] = { value: null, span: null, hallucinated: true };
      } else {
        attributes[key] = { value: a.value, span: loc.span, hallucinated: false };
      }
    }

    elements.push({
      detectedName: el.detectedName,
      normalizedName: el.normalizedName,
      role: el.role,
      span: elLoc.span,
      multiplicity: Math.max(1, Math.trunc(el.multiplicity || 1)),
      multiplicityStated: el.multiplicityStated,
      attributes,
    });
  }

  return {
    rowRef: row.itemRef,
    outOfFamily: raw.outOfFamily,
    outOfFamilyReason: raw.outOfFamilyReason,
    elements,
    hallucinations,
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
      skippedLlm: true,
      tier: 'none',
      escalated: false,
      error: null,
    };
  }

  const call = async (tier: 'main' | 'cheap'): Promise<Analysis> => {
    const { data } = await llm.complete<RawAnalysis>({
      system: ANALYZE_SYSTEM,
      user: analyzeUser(row.sourceText, row.itemRef),
      schema: ANALYZE_SCHEMA,
      schemaName: 'mto_row_analysis',
      maxTokens: 8192,
      tier,
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
  const limit = opts.concurrency ?? 6;
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

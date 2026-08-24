/**
 * Baseline extractor — "split + extract WITHOUT a model".
 *
 * This is the ablation the whole architecture argument hangs on. `docs/04-architecture.md` and the
 * 2-pager both claim the LLM only has to justify its DELTA over what closed tables already resolve;
 * `analyze.ts` names this file's job in its header ("the deterministic baseline in src/rules plays
 * the role of split without a model"). Until now that delta was asserted, not measured: `rules:audit`
 * reports "does a name appear in the row", which is not the same question as "is the row split into
 * the right number of lines with each attribute on the right element". This module produces a real
 * `Analysis` from tables alone, so `pnpm run eval -- --ablate=extract` runs the SAME normalize →
 * validate → score → gold comparison against it and the number falls out.
 *
 * WHAT IT DOES, and why exactly this and no more:
 *
 *  1. Split by `findNames`: one element per catalogue name the §3 table recognises, in order. A row
 *     phrased so the tables see no name yields zero elements → NO_ELEMENTS_EXTRACTED, exactly as the
 *     LLM path handles an empty extraction. This is where the baseline structurally loses on prose
 *     the aliases do not cover (the blind set is built to bring exactly that).
 *
 *  2. Attribute by PROXIMITY: each detected attribute goes to the nearest preceding element name.
 *     This is the honest deterministic rule — it is correct on single-element rows and cannot know,
 *     on `STUD BOLT ... ASTM A193 GR B7 ... 2 HEX NUT ASTM A194 GR 2H`, that GR 2H is the nut's and
 *     not the stud's when both grades sit in one MATERIAL cell after every name. That attribution is
 *     the entire problem the LLM buys, and the delta measures precisely it.
 *
 * WHAT IT DOES NOT DO, on purpose: it never guesses. A value it cannot place is left absent, so the
 * validator sends the line to review with a typed reason — the baseline is allowed to be blind, never
 * to invent. It reuses `analysisFromResponse` so span verification, the row-decides-multiplicity
 * rule and the out-of-family guard are IDENTICAL to the LLM path: the only variable under test is who
 * read the row.
 *
 * Everything is computed in FOLDED coordinates (upper-cased, diacritic-stripped) so the positions
 * from findNames/findStandards/findFinishes and the regex scans below share one coordinate system;
 * the evidence strings are folded substrings, which `locate()` maps back to the original row via its
 * case- and whitespace-insensitive fallbacks.
 */

import type { MtoRow } from './types.ts';
import { type Analysis, type AnalyzedAttrKey, type RawAnalysis, analysisFromResponse } from './analyze.ts';
import { fold } from '../rules/text.ts';
import { findNames } from '../rules/names.ts';
import { findStandards } from '../rules/standards.ts';
import { findFinishes } from '../rules/finish.ts';
import { findMaterials } from '../rules/material.ts';
import { QUALITY_GROUPS } from '../rules/quality.ts';
import { parseMeasure } from './measure.ts';

interface Hit {
  /** Folded text that will be handed to the extractor as this attribute's value/evidence. */
  text: string;
  /** Start offset in the folded row. Only used to attribute the hit to the nearest element. */
  at: number;
  /** End offset, so one detector can claim its span and the quality scan does not double-read it. */
  end: number;
}

/**
 * Quality tokens, as a longest-first word-bounded scan.
 *
 * Built from §5's own value list plus the ASTM grade shape (`GR B7`, `GR 2H`). This deliberately
 * mirrors the trap `normalizeQuality` warns about: deciding that a lone `8` or `10` in prose is a
 * quality is the extractor's judgement, and a table doing it mechanically WILL sometimes lift the
 * `10` of `DIN 934 10` or a standard's digits. That is not a bug in the baseline — it is the reason
 * the case says a table is not enough here, made visible in the number.
 */
const QUALITY_TOKENS: string[] = [
  ...[...QUALITY_GROUPS.values()].flat().map(fold),
].sort((a, b) => b.length - a.length);

const GRADE_RE = /\bGR\.?\s?(?:[A-Z]\s?\d+[A-Z]?|\d+[A-Z]?)\b/g;

/**
 * Measure designations: metric (`M16X60`), imperial (`7/8" X 130`), with an optional length tail.
 * Each candidate is validated by `parseMeasure`, which rejects anything that is not a real measure.
 */
const MEASURE_RE =
  /M\s?\d+(?:[.,]\d+)?(?:\s?[X×*]\s?\d+(?:[.,]\d+)?)?(?:\s?LG)?|(?:\d+\s?-\s?)?\d+\s?\/\s?\d+\s?"(?:\s?[X×*]\s?\d+(?:[.,]\d+)?)?(?:\s?LG)?|\d+(?:[.,]\d+)?\s?"(?:\s?[X×*]\s?\d+(?:[.,]\d+)?)?(?:\s?LG)?/g;

/** A length written with its own unit, apart from a designation: `40 MM`. */
const LENGTH_MM_RE = /\b\d+(?:[.,]\d+)?\s?MM\b/g;

/**
 * Word-bounded, claim-once scan for a closed list of tokens, longest-first. Like `findAliases`.
 *
 * `blocked` is the set of positions already read as a measure, standard, name or finish. Respecting
 * it is what keeps the baseline HONEST rather than a strawman: without it the `8` of `7/8"` gets read
 * as quality group G8, which is a tokenisation accident, not the attribution failure the ablation is
 * meant to expose. The genuine failures — a grade landing on the wrong element of a set — survive it.
 */
function scanTokens(folded: string, tokens: string[], blocked: boolean[]): Hit[] {
  const claimed = blocked.slice();
  const hits: Hit[] = [];
  for (const tok of tokens) {
    if (!tok) continue;
    const re = new RegExp(`(?<![A-Z0-9])${escapeRe(tok)}(?![A-Z0-9])`, 'g');
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const start = m.index;
      const end = start + tok.length;
      let free = true;
      for (let i = start; i < end; i++) if (claimed[i]) { free = false; break; }
      if (!free) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      hits.push({ text: tok, at: start, end });
    }
  }
  return hits;
}

function scanRegex(folded: string, re: RegExp, blocked?: boolean[]): Hit[] {
  const hits: Hit[] = [];
  const g = new RegExp(re.source, 'g');
  for (let m = g.exec(folded); m; m = g.exec(folded)) {
    const start = m.index;
    const end = start + m[0].length;
    const overlaps = blocked ? blocked.slice(start, end).some(Boolean) : false;
    if (!overlaps) hits.push({ text: m[0].trim(), at: start, end });
    if (m.index === g.lastIndex) g.lastIndex++;
  }
  return hits;
}

/** Marks a hit's span as read, so a later, lower-priority detector skips it. */
function claim(blocked: boolean[], hits: { at: number; end: number }[]): void {
  for (const h of hits) for (let i = h.at; i < h.end; i++) blocked[i] = true;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The element a hit belongs to: the last element whose name starts at or before the hit, else the first. */
function ownerOf(hitAt: number, nameStarts: number[]): number {
  let owner = 0;
  for (let i = 0; i < nameStarts.length; i++) {
    if (nameStarts[i] <= hitAt) owner = i;
    else break;
  }
  return owner;
}

/**
 * Deterministic extraction for one row: no model, no cost.
 *
 * Returns an `Analysis` shaped exactly like the LLM path's, so the rest of the pipeline cannot tell
 * the difference — which is the point: the eval harness compares the two on equal terms.
 */
export function analyzeRowBaseline(row: MtoRow): Analysis {
  const folded = fold(row.sourceText);
  const names = findNames(folded).sort((a, b) => a.span.start - b.span.start);

  // No catalogue name → the tables cannot split or extract. Reported, never invented.
  if (names.length === 0) {
    return { ...analysisFromResponse(empty(), row), tier: 'none' };
  }

  const nameStarts = names.map((n) => n.span.start);
  const perElement = names.map((n, i) => ({
    detectedName: n.alias,
    normalizedName: n.value,
    role: (i === 0 ? 'principal' : 'secondary') as 'principal' | 'secondary',
    evidence: n.alias,
    // Left at 1/false: the row — not the model, and not this baseline — decides multiplicity inside
    // `analysisFromResponse` via findMultiplicity, identically to the LLM path.
    multiplicity: 1,
    multiplicityStated: false,
    multiplicityEvidence: null as string | null,
    attributes: blankAttrs(),
  }));

  const assign = (key: AnalyzedAttrKey, hits: Hit[]): void => {
    for (const h of hits) {
      const owner = perElement[ownerOf(h.at, nameStarts)];
      // First writer wins per element: the nearest preceding hit is the most defensible attribution,
      // and a second value on the same element would be the baseline arguing with itself.
      if (owner.attributes[key].value === null) owner.attributes[key] = { value: h.text, evidence: h.text };
    }
  };

  // Positions read as something other than quality. The quality scan respects them so a measure's or
  // a standard's digits are not re-read as a grade — see scanTokens.
  const blocked = new Array(folded.length).fill(false);
  claim(blocked, names.map((n) => ({ at: n.span.start, end: n.span.end })));

  const standards = findStandards(folded).map((s) => ({ text: s.result.raw, at: s.span.start, end: s.span.end }));
  const finishes = findFinishes(folded).map((f) => ({ text: f.alias, at: f.span.start, end: f.span.end }));
  const materials = findMaterials(folded).map((m) => ({ text: m.alias, at: m.span.start, end: m.span.end }));
  const measures = scanRegex(folded, MEASURE_RE).filter((h) => parseMeasure(h.text) !== null);
  const lengths = scanRegex(folded, LENGTH_MM_RE);
  claim(blocked, [...standards, ...measures, ...lengths]);

  assign('standard', standards);
  assign('finish', finishes);
  assign('material', materials);
  assign('measure', measures);
  assign('length', lengths);

  const qualities = [...scanTokens(folded, QUALITY_TOKENS, blocked), ...scanRegex(folded, GRADE_RE, blocked)]
    .sort((a, b) => a.at - b.at);
  assign('quality', qualities);

  const raw: RawAnalysis = { outOfFamily: false, outOfFamilyReason: null, elements: perElement };
  return { ...analysisFromResponse(raw, row), tier: 'none' };
}

function blankAttrs(): Record<AnalyzedAttrKey, { value: string | null; evidence: string | null }> {
  return {
    material: { value: null, evidence: null },
    quality: { value: null, evidence: null },
    measure: { value: null, evidence: null },
    length: { value: null, evidence: null },
    standard: { value: null, evidence: null },
    finish: { value: null, evidence: null },
  };
}

function empty(): RawAnalysis {
  return { outOfFamily: false, outOfFamilyReason: null, elements: [] };
}

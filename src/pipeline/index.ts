/**
 * Orchestrator. Ingest -> analyze -> normalize -> validate -> score.
 *
 * The critic (SPEC-006) plugs in after scoring, over the middle confidence band only.
 */

import { ingest } from './ingest.ts';
import { analyzeRows, type Analysis, type ModelRouting } from './analyze.ts';
import { normalizeElement } from './normalize.ts';
import { validateRow } from './validate.ts';
import { scoreLine, thresholds, route, type Routing } from '../lib/confidence.ts';
import { criticiseRow, needsCritic, type CriticRouting } from './critic.ts';
import { detectGaps, policyBacklog, type PolicyGap, type PolicyBacklogItem } from './coverage.ts';
import type { Llm } from '../lib/llm.ts';
import type { Policies } from '../rules/policies.ts';
import type { MtoRow, OutputLine, ProcessResult } from './types.ts';

export interface ProcessOptions {
  policies?: Policies;
  concurrency?: number;
  routing?: ModelRouting;
  criticRouting?: CriticRouting;
  onProgress?: (done: number, total: number) => void;
}

export interface ProcessOutput extends ProcessResult {
  /** The ingested rows, verbatim. The UI trace panel highlights spans against `sourceText` here. */
  rows: MtoRow[];
  analyses: Analysis[];
  routing: Record<string, Routing>;
  hallucinations: { row: string; element: string; attribute: string; evidence: string }[];
  outOfFamilyRows: string[];
  tierUsage: { main: number; cheap: number; none: number; escalated: number };
  critic: { rowsRun: number; rowsEligible: number; downgraded: string[]; missingElements: { row: string; items: string[] }[] };
  /**
   * Cases no policy covers. A THIRD channel, deliberately not the buyer's queue: a gap is a rules
   * problem, not a data problem, and it is owed a decision rather than a correction.
   */
  gaps: PolicyGap[];
  policyBacklog: PolicyBacklogItem[];
}

export async function processMto(
  llm: Llm,
  file: string | Buffer,
  opts: ProcessOptions = {},
): Promise<ProcessOutput> {
  const started = Date.now();
  const { rows, skipped } = await ingest(file);

  let done = 0;
  const analyses = await analyzeRows(llm, rows, {
    concurrency: opts.concurrency,
    routing: opts.routing,
    onRow: () => opts.onProgress?.(++done, rows.length),
  });

  const t = thresholds();
  const criticRouting = opts.criticRouting ?? 'multi_element';
  const lines: OutputLine[] = [];
  const routing: Record<string, Routing> = {};
  const criticStats = {
    rowsRun: 0,
    rowsEligible: 0,
    downgraded: [] as string[],
    missingElements: [] as { row: string; items: string[] }[],
  };

  // Validate every row first (deterministic, free), then run the critic over the eligible rows
  // CONCURRENTLY. Sequentially it was one call at a time: at ~14s per call, 500 rows would be two
  // hours of wall clock for a stage that is meant to be a cheap safety net.
  const perRow = analyses.map((analysis, i) => ({
    analysis,
    row: rows[i],
    lines: validateRow(analysis, analysis.elements.map(normalizeElement), rows[i], { policies: opts.policies }),
  }));

  const eligible = perRow.filter((r) => needsCritic(r.analysis, criticRouting));
  criticStats.rowsEligible = eligible.length;

  if (eligible.length) {
    const limit = opts.concurrency ?? 6;
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(limit, eligible.length) }, async () => {
        for (;;) {
          const i = next++;
          if (i >= eligible.length) return;
          const e = eligible[i];
          const c = await criticiseRow(llm, e.row, e.analysis, e.lines, criticRouting);
          e.lines = c.lines;
          if (c.ran) criticStats.rowsRun++;
          criticStats.downgraded.push(...c.downgraded);
          if (c.missingElements.length) criticStats.missingElements.push({ row: e.row.itemRef, items: c.missingElements });
        }
      }),
    );
  }

  const gaps: PolicyGap[] = [];

  for (const { row, lines: rowLines } of perRow) {
    gaps.push(...detectGaps(row, rowLines));
    for (const line of rowLines) {
      line.confidence = scoreLine(line.attributes);
      const r = route(line, t);
      routing[line.id] = r;
      // A line the score sends to review is a review line, even if the rules engine cleared it.
      if (r === 'review' && line.status === 'RESUELTA') {
        line.status = 'REVISION_MANUAL';
        line.reasons.push({
          code: 'LOW_CONFIDENCE',
          kind: 'LOW_CONFIDENCE',
          message: 'Varios datos son inferidos: conviene revisarlo',
          attribute: null,
        });
      }
      lines.push(line);
    }
  }

  return {
    lines,
    rows,
    analyses,
    routing,
    rowsIngested: rows.length,
    rowsSkipped: skipped.length,
    hallucinations: analyses.flatMap((a) => a.hallucinations.map((h) => ({ row: a.rowRef, ...h }))),
    outOfFamilyRows: analyses.filter((a) => a.outOfFamily).map((a) => a.rowRef),
    tierUsage: {
      main: analyses.filter((a) => a.tier === 'main').length,
      cheap: analyses.filter((a) => a.tier === 'cheap').length,
      none: analyses.filter((a) => a.tier === 'none').length,
      escalated: analyses.filter((a) => a.escalated).length,
    },
    metrics: {
      latencyMs: Date.now() - started,
      costEur: llm.stats.costUsd,
      llmCalls: llm.stats.calls,
      criticRunRatio: rows.length ? criticStats.rowsRun / rows.length : 0,
    },
    critic: criticStats,
    gaps,
    policyBacklog: policyBacklog(gaps),
  };
}

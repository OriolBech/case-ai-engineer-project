/**
 * Orchestrator. Ingest -> analyze -> normalize -> validate -> score.
 *
 * The critic (SPEC-006) plugs in after scoring, over the middle confidence band only.
 */

import { ingest } from './ingest.ts';
import { analyzeRows, type Analysis, type ModelRouting } from './analyze.ts';
import { analyzeRowBaseline } from './baseline.ts';
import { normalizeElement } from './normalize.ts';
import { validateRow } from './validate.ts';
import { scoreLine, thresholds, route, type Routing } from '../lib/confidence.ts';
import { criticRoutingFromEnv, criticiseRow, needsCritic, type CriticRouting } from './critic.ts';
import { detectGaps, policyBacklog, type PolicyGap, type PolicyBacklogItem } from './coverage.ts';
import type { Llm } from '../lib/llm.ts';
import { policiesFromEnv, type Policies, type PolicyOverride } from '../rules/policies.ts';
import type { MtoRow, OutputLine, ProcessResult } from './types.ts';

export interface ProcessOptions {
  /** Se omite en todas las llamadas normales: se resuelven desde el entorno. Ver policiesFromEnv. */
  policies?: Policies;
  concurrency?: number;
  routing?: ModelRouting;
  criticRouting?: CriticRouting;
  /**
   * Which reader produces the analyses. `'llm'` is the system (default). `'baseline'` is the
   * deterministic tables-only extractor of SPEC-003's ablation (src/pipeline/baseline.ts): no model,
   * no cost, and the critic is forced off because it too is an LLM stage. It is the number that
   * answers "you only pay the model for the delta over what tables resolve" — see
   * `pnpm run eval -- --ablate=extract`.
   */
  extractor?: 'llm' | 'baseline';
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
  critic: {
    rowsRun: number;
    rowsEligible: number;
    downgraded: string[];
    missingElements: { row: string; items: string[] }[];
    /** Rows the critic was supposed to check and could not. Never empty in silence: see CriticResult.failure. */
    failures: { row: string; reason: string }[];
  };
  /**
   * Cases no policy covers. A THIRD channel, deliberately not the buyer's queue: a gap is a rules
   * problem, not a data problem, and it is owed a decision rather than a correction.
   */
  gaps: PolicyGap[];
  policyBacklog: PolicyBacklogItem[];
  /**
   * Políticas que esta ejecución NO tomó por defecto. Vacío en una ejecución normal.
   *
   * Va en la salida y no en un log porque una medida tomada con políticas cambiadas no es comparable
   * con las cifras publicadas, y quien la lea tiene que enterarse sin ir a mirar el `.env`.
   */
  policyOverrides: PolicyOverride[];
}

export async function processMto(
  llm: Llm,
  file: string | Buffer,
  opts: ProcessOptions = {},
): Promise<ProcessOutput> {
  const started = Date.now();
  const { rows, skipped } = await ingest(file);

  let done = 0;
  const extractor = opts.extractor ?? 'llm';
  const analyses =
    extractor === 'baseline'
      ? rows.map((row) => {
          const a = analyzeRowBaseline(row);
          opts.onProgress?.(++done, rows.length);
          return a;
        })
      : await analyzeRows(llm, rows, {
          concurrency: opts.concurrency,
          routing: opts.routing,
          onRow: () => opts.onProgress?.(++done, rows.length),
        });

  // Un único punto de resolución para toda la ejecución: así ningún llamador puede olvidarse de
  // pasarlas —que es exactamente lo que pasaba— y las 12 filas del blind set corren con lo que diga
  // el `.env` de la máquina, no con lo que diga el código.
  const { policies, overrides: policyOverrides } = opts.policies
    ? { policies: opts.policies, overrides: [] as PolicyOverride[] }
    : policiesFromEnv();

  const t = thresholds();
  // The critic is an LLM stage: under the extract ablation there is no model, so it is off no matter
  // what the caller asked, and the run stays free and offline.
  //
  // DEFAULT `off`, and the default is a measurement, not an opinion. See `criticRoutingFromEnv`.
  const criticRouting = extractor === 'baseline' ? 'off' : opts.criticRouting ?? criticRoutingFromEnv();
  const lines: OutputLine[] = [];
  const routing: Record<string, Routing> = {};
  const criticStats = {
    rowsRun: 0,
    rowsEligible: 0,
    downgraded: [] as string[],
    missingElements: [] as { row: string; items: string[] }[],
    failures: [] as { row: string; reason: string }[],
  };

  // Validate every row first (deterministic, free), then run the critic over the eligible rows
  // CONCURRENTLY. Sequentially it was one call at a time: at ~14s per call, 500 rows would be two
  // hours of wall clock for a stage that is meant to be a cheap safety net.
  const perRow = analyses.map((analysis, i) => ({
    analysis,
    row: rows[i],
    lines: validateRow(analysis, analysis.elements.map(normalizeElement), rows[i], { policies }),
  }));

  const eligible = perRow.filter((r) => needsCritic(r.analysis, criticRouting));
  criticStats.rowsEligible = eligible.length;

  if (eligible.length) {
    const limit = opts.concurrency ?? 12;
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
          // A row the critic could not check is NOT a row that passed. It is counted and named, or
          // "3 de 4 ejecutadas" reads as a rounding detail instead of a hole in the safety net.
          else if (c.failure) criticStats.failures.push({ row: e.row.itemRef, reason: c.failure });
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
    policyOverrides,
  };
}

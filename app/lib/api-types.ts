/**
 * Wire format between app/api/process and the client. Reuses the pipeline's own types so the UI
 * and the pipeline never drift into two descriptions of the same line.
 */
import type { OutputLine } from '../../src/pipeline/types.ts';
import type { PolicyBacklogItem } from '../../src/pipeline/coverage.ts';

export interface ProcessRow {
  itemRef: string;
  sourceText: string;
  sheet: string;
  rowNumber: number;
}

/**
 * Everything the pipeline knows about a run WITHOUT a labelled answer sheet.
 *
 * This is the whole point of the shape: on the blind set of the session there is no gold, so the
 * three KPIs that need one — silent error, useful autonomy, split fidelity — cannot be computed. What
 * CAN be computed is where the risk sits and what the system does not know, and every field here is
 * one of those. `docs/02-kpi.md` §4 for the provenance ordering.
 */
export interface RunDiagnostics {
  /** Rows whose model call failed. Must be visible: a row lost in a demo is the worst outcome. */
  failedRows: { rowRef: string; kind: string; message: string }[];
  /** Evidence the model gave that is not in the row. The value was discarded and counted. */
  hallucinations: { row: string; element: string; attribute: string; evidence: string }[];
  /** Multiplicities the model claimed and the row does not justify. Demoted to 1, never applied. */
  rejectedMultiplicity: { row: string; element: string; claimed: number; reason: string }[];
  /** Rows the model says are not fasteners at all (policy P-9). Their own queue, never forced. */
  outOfFamilyRows: string[];
  /** Cases no policy covers: a decision the project owes, NOT the buyer's queue. */
  policyBacklog: PolicyBacklogItem[];
  /**
   * Políticas que esta ejecución no tomó por defecto. Vacío en una ejecución normal.
   * Se enseña en el panel porque un resultado con las reglas cambiadas no es el resultado publicado.
   */
  policyOverrides: { policy: string; env: string; value: string; fallback: string }[];
  gapRows: string[];
  /** Which tier produced each analysis, and what the critic did. */
  tierUsage: { main: number; cheap: number; none: number; escalated: number };
  /**
   * Qué hizo el crítico, y qué NO pudo hacer. `failures` no es telemetría: son líneas que salieron
   * sin la segunda lectura, y el comprador tiene derecho a saber cuáles antes de fiarse de ellas.
   */
  critic: { rowsRun: number; rowsEligible: number; downgraded: number; failures: { row: string; reason: string }[] };
}

export interface ProcessSummary {
  fileName: string;
  rowsIngested: number;
  rowsSkipped: number;
  lines: OutputLine[];
  rows: ProcessRow[];
  diagnostics: RunDiagnostics;
  metrics: {
    latencyMs: number;
    costEur: number;
    llmCalls: number;
    cacheHits: number;
    pricesConfigured: boolean;
  };
}

export type ProcessEvent =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; result: ProcessSummary; processedMtoId?: string }
  | { type: 'error'; message: string };

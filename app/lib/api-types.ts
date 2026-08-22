/**
 * Wire format between app/api/process and the client. Reuses the pipeline's own types so the UI
 * and the pipeline never drift into two descriptions of the same line.
 */
import type { OutputLine } from '../../src/pipeline/types.ts';

export interface ProcessRow {
  itemRef: string;
  sourceText: string;
  sheet: string;
  rowNumber: number;
}

export interface ProcessSummary {
  fileName: string;
  rowsIngested: number;
  rowsSkipped: number;
  lines: OutputLine[];
  rows: ProcessRow[];
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
  | { type: 'done'; result: ProcessSummary }
  | { type: 'error'; message: string };

/** Un `EvalReport` mínimo pero válido, para probar el histórico sin ejecutar el pipeline ni un LLM. */
import type { EvalReport, LineResult } from '../../harness.ts';

export function makeLine(overrides: Partial<LineResult> = {}): LineResult {
  return {
    rowRef: '1',
    goldId: 'g1',
    systemId: 's1',
    aligned: true,
    statusOk: true,
    goldStatus: 'RESUELTA',
    systemStatus: 'RESUELTA',
    allCertainOk: true,
    cells: [],
    missingReasons: [],
    extraReasons: [],
    goldOutOfScope: false,
    systemOutOfScope: false,
    ...overrides,
  };
}

export function makeReport(overrides: Partial<EvalReport> = {}): EvalReport {
  const lines = overrides.lines ?? [makeLine()];
  return {
    model: 'test-model',
    rows: 1,
    goldLines: 1,
    systemLines: 1,
    splitFidelity: { ok: 1, total: 1, pct: 100, failures: [] },
    silentErrorRate: { bad: 0, resolved: 1, pct: 0, lines: [] },
    usefulAutonomy: { ok: 1, total: 1, pct: 100 },
    queueNoise: { noisy: 0, review: 0, pct: 0, lines: [] },
    outOfScope: { goldLines: 0, detected: 0, missed: [], falsePositives: [] },
    statusAgreement: { ok: 1, total: 1, pct: 100 },
    traceFidelity: { ok: 1, total: 1, pct: 100, mismatches: [] },
    perAttribute: {
      name: { okC: 1, totalC: 1, pctC: 100, okP: 0, totalP: 0 },
    },
    reasonAgreement: { exact: 1, total: 1, pct: 100 },
    lines,
    ...overrides,
  };
}

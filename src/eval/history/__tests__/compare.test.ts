/**
 * Comparación entre dos ejecuciones. Ver SPEC-010 §Comparación mínima y puntos 6-9.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeHistoryDb } from '../db.ts';
import { saveRun, type EvaluationRunInput } from '../store.ts';
import { compareRuns } from '../compare.ts';
import { makeLine, makeReport } from './fixtures.ts';

let dir: string;

function baseInput(overrides: Partial<EvaluationRunInput> = {}): EvaluationRunInput {
  return {
    label: null,
    dataset: { name: 'gold', fingerprint: 'fp-a', rows: 2, goldLines: 2 },
    system: {
      gitCommit: 'c1',
      dirty: false,
      model: 'm1',
      provider: 'openai',
      routing: 'always_main',
      criticRouting: 'multi_element',
      policyFingerprint: 'pf-1',
      policyOverrides: [],
      configurationFingerprint: 'cf-1',
    },
    report: makeReport(),
    cost: { eur: 1, pricesConfigured: true },
    latencyMs: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eval-history-cmp-'));
  process.env.EVAL_HISTORY_DB = join(dir, 'h.sqlite');
  closeHistoryDb();
});

afterEach(() => {
  closeHistoryDb();
  delete process.env.EVAL_HISTORY_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe('comparabilidad', () => {
  test('mismo dataset y políticas: comparable', () => {
    const base = saveRun(baseInput());
    const cand = saveRun(baseInput());
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.comparable, true);
    assert.deepEqual(cmp.incompatibilities, []);
  });

  test('gold distinto (fingerprint de dataset distinto): no comparable', () => {
    const base = saveRun(baseInput());
    const cand = saveRun(baseInput({ dataset: { name: 'gold', fingerprint: 'fp-b', rows: 2, goldLines: 2 } }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.comparable, false);
    assert.ok(cmp.incompatibilities.some((i) => /dataset distinto/.test(i)));
  });

  test('políticas distintas: no comparable, pero sigue mostrando métricas', () => {
    const base = saveRun(baseInput());
    const withPolicies = baseInput();
    const cand = saveRun({ ...withPolicies, system: { ...withPolicies.system, policyFingerprint: 'pf-2' } });
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.comparable, false);
    assert.ok(cmp.metrics.length > 0, 'los números se muestran aunque no sean comparables');
  });

  test('no existe uno de los dos runs', () => {
    const base = saveRun(baseInput());
    assert.throws(() => compareRuns(base, 'no-existe'), /No existe/);
  });
});

describe('dirección declarada por métrica', () => {
  test('error silencioso: menor es mejor', () => {
    const base = saveRun(baseInput({ report: makeReport({ silentErrorRate: { bad: 2, resolved: 10, pct: 20, lines: [] } }) }));
    const cand = saveRun(baseInput({ report: makeReport({ silentErrorRate: { bad: 1, resolved: 10, pct: 10, lines: [] } }) }));
    const m = compareRuns(base, cand).metrics.find((x) => x.name === 'silent_error_rate')!;
    assert.equal(m.direction, 'improved');
  });

  test('autonomía útil: mayor es mejor, y aumentar el error silencioso no puede llamarse mejora aunque suba', () => {
    const base = saveRun(baseInput({ report: makeReport({ usefulAutonomy: { ok: 5, total: 10, pct: 50 } }) }));
    const cand = saveRun(baseInput({ report: makeReport({ usefulAutonomy: { ok: 3, total: 10, pct: 30 } }) }));
    const m = compareRuns(base, cand).metrics.find((x) => x.name === 'useful_autonomy')!;
    assert.equal(m.direction, 'regressed');
  });

  test('coste desconocido en cualquiera de los dos runs: se omite, nunca se compara contra 0', () => {
    const base = saveRun(baseInput({ cost: { eur: null, pricesConfigured: false } }));
    const cand = saveRun(baseInput({ cost: { eur: 2, pricesConfigured: true } }));
    const cmp = compareRuns(base, cand);
    assert.ok(!cmp.metrics.some((m) => m.name === 'cost_eur'));
  });

  test('latencia siempre se compara: menor es mejor', () => {
    const base = saveRun(baseInput({ latencyMs: 2000 }));
    const cand = saveRun(baseInput({ latencyMs: 1000 }));
    const m = compareRuns(base, cand).metrics.find((x) => x.name === 'latency_ms')!;
    assert.equal(m.direction, 'improved');
  });
});

describe('líneas que explican el delta', () => {
  test('una línea que pasa de mal a bien: fixed', () => {
    const bad = makeLine({ allCertainOk: false, systemStatus: 'RESUELTA' });
    const good = makeLine({ allCertainOk: true, systemStatus: 'RESUELTA' });
    const base = saveRun(baseInput({ report: makeReport({ lines: [bad] }) }));
    const cand = saveRun(baseInput({ report: makeReport({ lines: [good] }) }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.changedLines.length, 1);
    assert.equal(cmp.changedLines[0].change, 'fixed');
  });

  test('una línea que pasa de bien a mal: regressed', () => {
    const good = makeLine({ allCertainOk: true, systemStatus: 'RESUELTA' });
    const bad = makeLine({ allCertainOk: false, systemStatus: 'RESUELTA' });
    const base = saveRun(baseInput({ report: makeReport({ lines: [good] }) }));
    const cand = saveRun(baseInput({ report: makeReport({ lines: [bad] }) }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.changedLines[0].change, 'regressed');
  });

  test('una línea que desaparece: split_changed, no un acierto por ausencia', () => {
    const line = makeLine();
    const base = saveRun(baseInput({ report: makeReport({ lines: [line] }) }));
    const cand = saveRun(baseInput({ report: makeReport({ lines: [] }) }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.changedLines.length, 1);
    assert.equal(cmp.changedLines[0].change, 'split_changed');
  });

  test('cambio de estado sin cambiar el veredicto de acierto: status_changed', () => {
    const base = saveRun(baseInput({ report: makeReport({ lines: [makeLine({ systemStatus: 'REVISION_MANUAL', allCertainOk: false })] }) }));
    const cand = saveRun(baseInput({ report: makeReport({ lines: [makeLine({ systemStatus: 'RESUELTA', allCertainOk: false })] }) }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.changedLines[0].change, 'status_changed');
  });

  test('sin cambios: ninguna línea en el diagnóstico', () => {
    const line = makeLine();
    const base = saveRun(baseInput({ report: makeReport({ lines: [line] }) }));
    const cand = saveRun(baseInput({ report: makeReport({ lines: [{ ...line }] }) }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.changedLines.length, 0);
  });

  test('una línea de sistema sin contrapartida en el gold no entra en el diagnóstico fila a fila', () => {
    const line = makeLine({ goldId: null, systemId: 's2', aligned: false });
    const base = saveRun(baseInput({ report: makeReport({ lines: [] }) }));
    const cand = saveRun(baseInput({ report: makeReport({ lines: [line] }) }));
    const cmp = compareRuns(base, cand);
    assert.equal(cmp.changedLines.length, 0);
  });
});

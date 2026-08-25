/**
 * Persistencia transaccional del histórico. Ver SPEC-010 §Criterios de aceptación.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeHistoryDb, openHistoryDb } from '../db.ts';
import { getRun, getRunLines, getRunMetrics, listRuns, saveRun, type EvaluationRunInput } from '../store.ts';
import { makeLine, makeReport } from './fixtures.ts';

let dir: string;

function baseInput(overrides: Partial<EvaluationRunInput> = {}): EvaluationRunInput {
  return {
    label: null,
    dataset: { name: 'gold', fingerprint: 'fp-dataset-1', rows: 10, goldLines: 10 },
    system: {
      gitCommit: 'abc123',
      dirty: false,
      model: 'gpt-test',
      provider: 'openai',
      routing: 'always_main',
      criticRouting: 'multi_element',
      policyFingerprint: 'fp-policy-1',
      policyOverrides: [],
      configurationFingerprint: 'fp-config-1',
    },
    report: makeReport(),
    cost: { eur: 0.1234, pricesConfigured: true },
    latencyMs: 5000,
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eval-history-'));
  process.env.EVAL_HISTORY_DB = join(dir, 'h.sqlite');
  closeHistoryDb();
});

afterEach(() => {
  closeHistoryDb();
  delete process.env.EVAL_HISTORY_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe('guardar una ejecución', () => {
  test('añade exactamente un run completo, con métricas y líneas', () => {
    const id = saveRun(baseInput());
    const run = getRun(id);
    assert.ok(run);
    assert.equal(run?.datasetFingerprint, 'fp-dataset-1');
    assert.equal(listRuns().length, 1);

    const metrics = getRunMetrics(id);
    const ser = metrics.find((m) => m.scope === 'global' && m.name === 'silent_error_rate');
    assert.equal(ser?.numerator, 0);
    assert.equal(ser?.denominator, 1);

    const lines = getRunLines(id);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].goldId, 'g1');
  });

  test('repetirlo no sobrescribe el anterior: dos runs distintos e independientes', () => {
    const id1 = saveRun(baseInput({ label: 'uno' }));
    const id2 = saveRun(baseInput({ label: 'dos' }));
    assert.notEqual(id1, id2);
    assert.equal(listRuns().length, 2);
    assert.equal(getRun(id1)?.label, 'uno');
    assert.equal(getRun(id2)?.label, 'dos');
  });

  test('guardar dos veces con la misma etiqueta produce dos runs, no una actualización', () => {
    saveRun(baseInput({ label: 'material-v2' }));
    saveRun(baseInput({ label: 'material-v2' }));
    assert.equal(listRuns().filter((r) => r.label === 'material-v2').length, 2);
  });
});

describe('numeradores y denominadores', () => {
  test('se conservan además del porcentaje: 100% [1/1] no es 100% [200/200]', () => {
    const idSmall = saveRun(baseInput({ report: makeReport({ usefulAutonomy: { ok: 1, total: 1, pct: 100 } }) }));
    const idBig = saveRun(baseInput({ report: makeReport({ usefulAutonomy: { ok: 200, total: 200, pct: 100 } }) }));
    const small = getRunMetrics(idSmall).find((m) => m.name === 'useful_autonomy')!;
    const big = getRunMetrics(idBig).find((m) => m.name === 'useful_autonomy')!;
    assert.equal(small.value, big.value);
    assert.notEqual(small.denominator, big.denominator);
  });

  test('la cantidad es una celda más del error silencioso, no un atributo aparte', () => {
    const line = makeLine({
      allCertainOk: false,
      cells: [{
        lineId: 's1', rowRef: '1', attribute: 'quantity', certainty: 'C',
        expected: '100', got: '10000', ok: false,
        // Valor mal => la procedencia no se gradúa: `provenanceOk` null. Castigar dos veces el
        // mismo fallo diría que hay dos problemas donde hay uno.
        expectedProvenance: 'extracted', gotProvenance: 'inferred', provenanceOk: null,
      }],
    });
    const id = saveRun(
      baseInput({ report: makeReport({ lines: [line], silentErrorRate: { bad: 1, resolved: 1, pct: 100, lines: ['s1'] } }) }),
    );
    const [stored] = getRunLines(id);
    assert.equal(stored.cells[0].attribute, 'quantity');
    assert.equal(stored.cells[0].ok, false);
  });
});

describe('coste desconocido', () => {
  test('se guarda como null, nunca como 0', () => {
    const id = saveRun(baseInput({ cost: { eur: null, pricesConfigured: false } }));
    assert.equal(getRun(id)?.costEur, null);
  });

  test('un eur no nulo con pricesConfigured=false también se guarda como null: la bandera manda', () => {
    const id = saveRun(baseInput({ cost: { eur: 99, pricesConfigured: false } }));
    assert.equal(getRun(id)?.costEur, null);
  });
});

describe('atomicidad', () => {
  test('un fallo durante la escritura no deja ejecuciones parciales', () => {
    const conn = openHistoryDb();
    const before = (conn.prepare('SELECT COUNT(*) AS n FROM evaluation_runs').get() as { n: number }).n;

    // Dos líneas con la MISMA clave primaria (mismo rowRef/goldId/systemId) violan el UNIQUE a mitad
    // de la inserción de líneas, después de que la cabecera del run ya se insertó en la transacción.
    const bad = baseInput({ report: makeReport({ lines: [makeLine(), makeLine()] }) });
    assert.throws(() => saveRun(bad));

    const after = (conn.prepare('SELECT COUNT(*) AS n FROM evaluation_runs').get() as { n: number }).n;
    assert.equal(after, before, 'el run no debe quedar visible si la transacción no completó');
  });

  test('cerrar y reabrir la base conserva los runs guardados', () => {
    const id = saveRun(baseInput());
    closeHistoryDb();
    openHistoryDb();
    assert.ok(getRun(id));
  });

  test('una base con versión de esquema distinta revienta en vez de reinterpretar en silencio', () => {
    const conn = openHistoryDb();
    conn.prepare(`UPDATE schema_meta SET value = '999' WHERE key = 'version'`).run();
    closeHistoryDb();
    assert.throws(() => openHistoryDb(), /esquema/);
  });
});

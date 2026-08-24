/**
 * Vocabulario de acabado — SPEC-011. Las cinco guardas y la reconstrucción desde log.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addEntry, closeFinishDb, listCatalog, listChanges, listEntries, openFinishDb, resolveFinish, retireEntry,
  assertNoRegressionForTest,
} from '../finish-db.ts';
import { addVocab, retireVocab } from '../vocab.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'finish-vocab-'));
  copyFileSync(join('data', 'vocabulary', 'finish-alias.json'), join(dir, 'seed.json'));
  process.env.VOCAB_FINISH_DB = join(dir, 'v.sqlite');
  process.env.VOCAB_FINISH = join(dir, 'seed.json');
  process.env.VOCAB_FINISH_LOG = join(dir, 'log.jsonl');
  closeFinishDb();
});

afterEach(() => {
  closeFinishDb();
  delete process.env.VOCAB_FINISH_DB;
  delete process.env.VOCAB_FINISH;
  delete process.env.VOCAB_FINISH_LOG;
  rmSync(dir, { recursive: true, force: true });
});

describe('resolveFinish · migración no-op con la semilla', () => {
  test('alias existentes resuelven igual que antes', () => {
    const plated = resolveFinish('zinc plated');
    assert.equal(plated.kind, 'known');
    if (plated.kind === 'known') assert.equal(plated.finish, 'CINCADO');
    assert.equal(resolveFinish('ZN')?.kind, 'known');
    assert.equal(resolveFinish('GEOMET-500B').kind, 'known');
  });
});

describe('guardas de addEntry', () => {
  test('1 · id repetido → rechazo', () => {
    assert.throws(() => addEntry({
      id: 'seed-cincado-zn', alias: 'OTRO', kind: 'alias', finish: 'CINCADO',
      rationale: 'r', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23'), /Ya existe/);
  });

  test('2 · ambigüedad → rechazo', () => {
    assert.throws(() => addEntry({
      id: 'finish-zn-bicromatado', alias: 'ZN', kind: 'alias', finish: 'BICROMATADO',
      rationale: 'r', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23', undefined, { allowShortAlias: true }), /ambigua|ya lleva/);
  });

  test('3 · no-regresión → ZINC no altera ZINC PLATED (más largo gana)', () => {
    assert.doesNotThrow(() => assertNoRegressionForTest({
      id: 'finish-zinc-extra', alias: 'ZINC', kind: 'alias', finish: 'CINCADO',
      source: 'added', rationale: 'r', decidedBy: 'p', evidence: 'e',
    }, listEntries()));
  });

  test('3b · no-regresión → rechazo si cambia la lectura de un alias vivo', () => {
    const live = [{
      id: 'only', alias: 'GALV ELECTROLITICO', kind: 'alias' as const, finish: 'CINCADO' as const,
      source: 'client' as const, rationale: 'r', decidedBy: 'p', decidedAt: 'd', evidence: 'e',
      retiredAt: null, retiredWhy: null,
    }];
    assert.throws(() => assertNoRegressionForTest({
      id: 'steals', alias: 'GALV ELECTROLITICO', kind: 'alias', finish: 'PAVONADO',
      source: 'added', rationale: 'r', decidedBy: 'p', evidence: 'e',
    }, live), /ambigua|ya lleva/);
  });

  test('4 · alias corto → rechazo salvo flag', () => {
    assert.throws(() => addEntry({
      id: 'finish-xx', alias: 'XX', kind: 'alias', finish: 'CINCADO',
      rationale: 'r', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23'), /menos de 3 caracteres/);
    assert.doesNotThrow(() => addEntry({
      id: 'finish-xx-ok', alias: 'XX', kind: 'alias', finish: 'CINCADO',
      rationale: 'r', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23', undefined, { allowShortAlias: true, skipGoldCheck: true }));
  });

  test('5 · regresión gold → rechazo si cambia una lectura del gold', () => {
    assert.throws(() => addEntry({
      id: 'finish-cincado-mal', alias: 'CINCADO', kind: 'alias', finish: 'PAVONADO',
      rationale: 'r', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23'), /gold set|ambigua|ya lleva/);
  });

  test('acabado nuevo fuera de la semilla → alta permitida y resolveFinish known', () => {
    assert.equal(resolveFinish('niquelado').kind, 'unknown');
    addEntry({
      id: 'finish-niquelado', alias: 'niquelado', kind: 'alias', finish: 'NIQUELADO',
      rationale: 'recubrimiento real del pliego', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23', undefined, { skipGoldCheck: true });
    const r = resolveFinish('niquelado');
    assert.equal(r.kind, 'known');
    if (r.kind === 'known') assert.equal(r.finish, 'NIQUELADO');
    assert.ok(listCatalog().includes('NIQUELADO'));
  });
});

describe('ampliable · log y reconstrucción', () => {
  test('añadir cubre un acabado desconocido', () => {
    assert.equal(resolveFinish('tropicalizado').kind, 'unknown');
    addEntry({
      id: 'finish-tropicalizado', alias: 'tropicalizado', kind: 'alias', finish: 'CINCADO',
      rationale: 'según pliego', decidedBy: 'Comprador', source: 'added', evidence: 'pliego §4',
    }, '2026-08-23', undefined, { skipGoldCheck: true });
    assert.equal(resolveFinish('tropicalizado').kind, 'known');
  });

  test('not_a_finish no produce hueco lógico', () => {
    addEntry({
      id: 'finish-segun-pliego', alias: 'según pliego cliente', kind: 'not_a_finish', finish: null,
      rationale: 'texto administrativo', decidedBy: 'Comprador', source: 'added', evidence: 'pliego',
    }, '2026-08-23', undefined, { skipGoldCheck: true });
    assert.equal(resolveFinish('según pliego cliente').kind, 'not_a_finish');
  });

  test('la base se reconstruye desde cero', () => {
    addEntry({
      id: 'finish-tropicalizado', alias: 'tropicalizado', kind: 'alias', finish: 'CINCADO',
      rationale: 'r', decidedBy: 'p', source: 'added', evidence: 'e',
    }, '2026-08-23', undefined, { skipGoldCheck: true });
    rmSync(join(dir, 'v.sqlite'), { force: true });
    closeFinishDb();
    openFinishDb();
    assert.ok(listEntries().some((e) => e.id === 'finish-tropicalizado'));
  });

  test('front y CLI escriben la misma línea de log', () => {
    addEntry({
      id: 'finish-cli', alias: 'delta-protekt', kind: 'alias', finish: 'GEOMET',
      rationale: 'r', decidedBy: 'CLI', source: 'added', evidence: 'norma X',
    }, '2026-08-23', undefined, { skipGoldCheck: true });
    const line = readFileSync(join(dir, 'log.jsonl'), 'utf8').trim();
    const ev = JSON.parse(line);
    assert.equal(ev.entry.id, 'finish-cli');
    assert.equal(ev.by, 'CLI');
  });

  test('retirar deja traza', () => {
    retireEntry('seed-cincado-zn', 'error del cliente', 'Prueba', '2026-08-24');
    assert.equal(resolveFinish('ZN').kind, 'unknown');
    const row = listEntries({ includeRetired: true }).find((e) => e.id === 'seed-cincado-zn');
    assert.equal(row?.retiredAt, '2026-08-24');
    assert.ok(listChanges().some((c) => c.action === 'retire'));
  });
});

describe('retirar y volver a añadir (flujo del front)', () => {
  const alta = {
    attribute: 'finish' as const,
    match: 'tropicalizado',
    value: 'CINCADO',
    rationale: 'según pliego',
    decidedBy: 'compras',
    evidence: 'pliego',
  };

  test('el mismo alias se puede dar de alta otra vez tras retirarlo', () => {
    const first = addVocab(alta, { force: true });
    assert.equal(first.ok, true);
    assert.equal(resolveFinish('tropicalizado').kind, 'known');

    retireVocab('finish', 'finish-tropicalizado', 'me equivoqué', 'compras');
    assert.equal(resolveFinish('tropicalizado').kind, 'unknown');

    const again = addVocab(alta, { force: true });
    assert.ok(again.ok, again.error ?? 'unexpected failure');
    const r = resolveFinish('tropicalizado');
    assert.equal(r.kind, 'known');
    if (r.kind === 'known') assert.equal(r.finish, 'CINCADO');

    const rows = listEntries({ includeRetired: true }).filter((e) => e.alias === 'tropicalizado');
    assert.equal(rows.length, 2);
    assert.ok(rows.some((e) => e.id === 'finish-tropicalizado' && e.retiredAt));
    assert.ok(rows.some((e) => e.id === 'finish-tropicalizado-2' && !e.retiredAt));
  });

  test('sin retirar, el id derivado sigue bloqueando el alta', () => {
    assert.equal(addVocab(alta, { force: true }).ok, true);
    const dup = addVocab(alta, { force: true });
    assert.equal(dup.ok, false);
    assert.match(dup.error ?? '', /Ya existe/);
  });
});

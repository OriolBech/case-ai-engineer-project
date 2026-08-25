/**
 * La capa 2 de calidad (SPEC-017): cerrada, trazable y ampliable, con la guarda que la hace
 * distinta de las demás — aquí una entrada declara INTERCAMBIABILIDAD, así que contradecir §5 es
 * el fallo caro.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addEntry, closeQualityDb, listChanges, listEntries, openQualityDb, resolveQuality, retireEntry,
} from '../quality-db.ts';
import { deriveMaterial, isDerived, closeVocabularyDb } from '../vocabulary-db.ts';

let dir: string;

/** Semilla vacía: la capa 2 nace sin entradas. */
const SEED = { version: 1, attribute: 'quality', entries: [] };

const base = {
  rationale: 'Prueba',
  decidedBy: 'Prueba',
  evidence: 'test',
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qual-vocab-'));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(SEED), 'utf8');
  process.env.VOCAB_QUALITY_DB = join(dir, 'q.sqlite');
  process.env.VOCAB_QUALITY = join(dir, 'seed.json');
  process.env.VOCAB_QUALITY_LOG = join(dir, 'log.jsonl');
  closeQualityDb();
});

afterEach(() => {
  closeQualityDb();
  delete process.env.VOCAB_QUALITY_DB;
  delete process.env.VOCAB_QUALITY;
  delete process.env.VOCAB_QUALITY_LOG;
  rmSync(dir, { recursive: true, force: true });
});

describe('resolución en dos capas', () => {
  test('§5 manda primero: un valor de catálogo resuelve por catálogo aunque la capa 2 esté vacía', () => {
    const r = resolveQuality('A4-70');
    assert.equal(r.source, 'catalog');
    assert.equal(r.group, 'G3');
    assert.equal(r.entryId, null);
  });

  test('fuera de §5 y sin entrada: out, sin grupo', () => {
    const r = resolveQuality('45H');
    assert.equal(r.source, 'out');
    assert.equal(r.group, null);
    assert.equal(r.inCatalog, false);
  });

  test('una entrada de capa 2 da grupo y traza', () => {
    addEntry({ id: 'qual-45h-g9', alias: '45H', group: 'G9', ...base }, '2026-08-25');
    const r = resolveQuality('45h');
    assert.equal(r.source, 'vocab');
    assert.equal(r.group, 'G9');
    assert.equal(r.entryId, 'qual-45h-g9');
  });

  test('la capa 1 gana siempre: un valor de §5 no lo remapa la capa 2', () => {
    addEntry({ id: 'qual-a480-g2', alias: 'A4-80', group: 'G2', ...base }, '2026-08-25', undefined, { force: true, skipGoldCheck: true });
    const r = resolveQuality('A4-80');
    assert.equal(r.source, 'catalog');
    assert.equal(r.group, 'G4', 'A4-80 sigue siendo G4 aunque alguien la haya metido en G2');
  });

  test('ambigua: dos entradas vivas con grupos distintos no eligen, reportan', () => {
    addEntry({ id: 'qual-x-g8', alias: 'X9', group: 'G8', ...base }, '2026-08-25');
    addEntry({ id: 'qual-x-g9', alias: 'x9', group: 'G9', ...base }, '2026-08-25', undefined, { force: true, skipGoldCheck: true });
    const r = resolveQuality('X9');
    assert.equal(r.source, 'ambiguous');
    assert.equal(r.group, null);
    assert.equal(r.candidates?.length, 2);
  });
});

describe('cerrada · guardas', () => {
  test('grupo fuera de los 14 de §5: imposible ni con force', () => {
    assert.throws(
      () => addEntry({ id: 'qual-x', alias: 'X', group: 'G99' as never, ...base }, '2026-08-25', undefined, { force: true }),
      /no es uno de los 14/,
    );
  });

  test('contradecir §5 avisa: A4-80 ya es G4 del catálogo del cliente', () => {
    assert.throws(
      () => addEntry({ id: 'qual-a480-g2', alias: 'A4-80', group: 'G2', ...base }, '2026-08-25', undefined, { skipGoldCheck: true }),
      /contradice el documento del cliente/,
    );
    const { warnings } = addEntry(
      { id: 'qual-a480-g2', alias: 'A4-80', group: 'G2', ...base },
      '2026-08-25', undefined, { force: true, skipGoldCheck: true },
    );
    assert.ok(warnings.some((w) => w.includes('contradice el documento del cliente')));
  });

  test('mismo token a otro grupo por la capa 2 avisa de ambigüedad', () => {
    addEntry({ id: 'qual-x-g8', alias: 'X9', group: 'G8', ...base }, '2026-08-25');
    const { warnings } = addEntry(
      { id: 'qual-x-g9', alias: 'x9', group: 'G9', ...base },
      '2026-08-25', undefined, { force: true, skipGoldCheck: true },
    );
    assert.ok(warnings.some((w) => w.includes('haría ambigua')));
  });

  test('el gold manda: un token que es calidad CIERTA del gold no puede cambiar de lectura sin aviso', () => {
    // GR B7 es calidad CIERTA del gold y está fuera de §5: darle grupo cambia su lectura.
    const { warnings } = addEntry(
      { id: 'qual-grb7-g5', alias: 'GR B7', group: 'G5', ...base },
      '2026-08-25', undefined, { force: true },
    );
    assert.ok(warnings.some((w) => w.includes('gold set')));
  });

  test('id repetido no se reutiliza, ni con force', () => {
    addEntry({ id: 'qual-x', alias: 'X9', group: 'G8', ...base }, '2026-08-25');
    assert.throws(
      () => addEntry({ id: 'qual-x', alias: 'OTRO', group: 'G9', ...base }, '2026-08-25', undefined, { force: true }),
      /no se reutilizan/,
    );
  });
});

describe('trazable y ampliable', () => {
  test('alta y retiro pasan por el log; retirada deja de resolver', () => {
    addEntry({ id: 'qual-45h-g9', alias: '45H', group: 'G9', ...base }, '2026-08-25');
    assert.equal(resolveQuality('45H').group, 'G9');

    retireEntry('qual-45h-g9', 'Decisión equivocada.', 'Prueba', '2026-08-26');
    assert.equal(resolveQuality('45H').source, 'out');

    const changes = listChanges();
    assert.deepEqual(changes.map((c) => c.action), ['retire', 'add']);
    // La entrada retirada sigue existiendo, con su motivo: no se borra.
    const retired = listEntries({ includeRetired: true }).find((e) => e.id === 'qual-45h-g9');
    assert.equal(retired?.retiredWhy, 'Decisión equivocada.');
  });

  test('una calidad de capa 2 deriva material por su grupo, como cualquier valor de §5', () => {
    // Usa la base de material real (solo lectura): G9 → AC está sembrado ahí.
    closeVocabularyDb();
    delete process.env.VOCAB_DB;
    delete process.env.VOCAB_MATERIAL;
    delete process.env.VOCAB_LOG;
    addEntry({ id: 'qual-45h-g9', alias: '45H', group: 'G9', ...base }, '2026-08-25');
    const d = deriveMaterial('45H');
    assert.ok(isDerived(d));
    assert.equal(isDerived(d) && d.material, 'AC');
    closeVocabularyDb();
  });
});

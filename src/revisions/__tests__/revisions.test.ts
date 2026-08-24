/**
 * Persistencia de revisiones y anotación RFQ. SPEC-014.
 */
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { identifiable } from '../../domain/identity.ts';
import { diffRevisions } from '../../domain/revision-diff.ts';
import { annotateRfqExports, diffIdentifiableLines } from '../diff-service.ts';
import { closeRevisionDb, getRevisionStore, resetRevisionStore, SqliteRevisionStore, openRevisionDb } from '../sqlite-store.ts';

const bolt = (over: {
  id?: string;
  qty?: number | null;
  finish?: string | null;
  rowRef?: string;
  measure?: string;
  status?: 'RESUELTA' | 'REVISION_MANUAL';
} = {}) =>
  identifiable({
    id: over.id ?? 'L1',
    parts: {
      name: 'TORNILLO',
      material: 'AC',
      quality: '8.8',
      measure: over.measure ?? 'M16',
      length: '60 mm',
      standard: 'ISO 4017',
      finish: over.finish === undefined ? 'CINCADO' : over.finish,
    },
    quantity: over.qty ?? 100,
    status: over.status ?? 'RESUELTA',
    itemRef: over.rowRef ?? '10',
    rowRef: over.rowRef ?? '10',
  });

describe('SqliteRevisionStore', () => {
  beforeEach(() => {
    resetRevisionStore();
    process.env.REVISIONS_DB = ':memory:';
  });
  afterEach(() => {
    resetRevisionStore();
    delete process.env.REVISIONS_DB;
  });

  test('save y load devuelven el snapshot', () => {
    const store = getRevisionStore();
    const lines = [bolt({ id: 'a' })];
    store.save({ projectId: 'MTO-001', revisionId: 'rev-1', at: '2026-01-01T00:00:00Z', lines });
    const loaded = store.load('MTO-001', 'rev-1');
    assert.ok(loaded);
    assert.equal(loaded.projectId, 'MTO-001');
    assert.equal(loaded.lines.length, 1);
    assert.equal(loaded.lines[0].fingerprint, lines[0].fingerprint);
  });

  test('listRevisions ordena por fecha', () => {
    const store = getRevisionStore();
    store.save({ projectId: 'P', revisionId: 'r2', at: '2026-02-01T00:00:00Z', lines: [] });
    store.save({ projectId: 'P', revisionId: 'r1', at: '2026-01-01T00:00:00Z', lines: [] });
    assert.deepEqual(store.listRevisions('P'), ['r1', 'r2']);
  });

  test('recordRfqExport y getRfqExports', () => {
    const store = getRevisionStore();
    const fp = bolt().fingerprint;
    store.recordRfqExport('P', 'r1', [fp]);
    store.recordRfqExport('P', 'r1', [fp]); // idempotente
    const exports = store.getRfqExports('P', 'r1');
    assert.equal(exports.size, 1);
    assert.ok(exports.has(fp));
  });
});

describe('diff via snapshots', () => {
  test('ITEM/row shift no crea added+removed', () => {
    const prev = [bolt({ id: 'p', rowRef: '5' })];
    const curr = [
      bolt({ id: 'new', rowRef: '5', finish: null, qty: 40, status: 'REVISION_MANUAL' }),
      bolt({ id: 'c', rowRef: '6' }),
    ];
    // fix the "new" line to be a different material (TUERCA) - use identity test pattern
    curr[0] = identifiable({
      id: 'new',
      parts: {
        name: 'TUERCA',
        material: 'AC',
        quality: null,
        measure: 'M16',
        length: null,
        standard: 'ISO 4032',
        finish: null,
      },
      quantity: 40,
      status: 'REVISION_MANUAL',
      itemRef: '5',
      rowRef: '5',
    });
    const s = diffIdentifiableLines(prev, curr).summary;
    assert.equal(s.added, 1);
    assert.equal(s.removed, 0);
    assert.equal(s.unchanged, 1);
  });

  test('acabado vacío vs CINCADO no es unchanged', () => {
    const prev = [bolt({ finish: null })];
    const curr = [bolt({ finish: 'CINCADO' })];
    const s = diffIdentifiableLines(prev, curr).summary;
    assert.equal(s.unchanged, 0);
    assert.equal(s.added, 1);
    assert.equal(s.removed, 1);
  });

  test('huella duplicada → ambiguous', () => {
    const prev = [bolt({ id: 'p1', qty: 10 }), bolt({ id: 'p2', qty: 20 })];
    const curr = [bolt({ id: 'c', qty: 30 })];
    const d = diffRevisions(prev, curr);
    assert.equal(d.length, 1);
    assert.equal(d[0].kind, 'ambiguous');
  });

  test('annotateRfqExports solo en RESUELTA+exportada, nunca REVISION_MANUAL', () => {
    const prev = [
      bolt({ id: 'r', status: 'RESUELTA' }),
      bolt({ id: 'm', status: 'REVISION_MANUAL', measure: 'M12' }),
    ];
    const curr = [
      bolt({ id: 'r2', status: 'RESUELTA' }),
      bolt({ id: 'm2', status: 'REVISION_MANUAL', measure: 'M12' }),
    ];
    const deltas = diffRevisions(prev, curr);
    const exported = new Set([prev[0].fingerprint]);
    const annotated = annotateRfqExports(deltas, exported);
    const resolved = annotated.find((d) => d.kind === 'unchanged' && d.previous.id === 'r');
    const manual = annotated.find((d) => d.kind === 'unchanged' && d.previous.id === 'm');
    assert.equal(resolved?.kind === 'unchanged' && resolved.rfqExported, true);
    assert.equal(manual?.kind === 'unchanged' && manual.rfqExported, undefined);
  });

  test('diff entre dos snapshots persistidos', () => {
    resetRevisionStore();
    process.env.REVISIONS_DB = ':memory:';
    const conn = openRevisionDb();
    const store = new SqliteRevisionStore(conn);
    const prevLines = [bolt({ id: 'p', qty: 50 })];
    const currLines = [bolt({ id: 'c', qty: 200 })];
    store.save({ projectId: 'proj', revisionId: 'v9', at: '2026-01-01T00:00:00Z', lines: prevLines });
    store.save({ projectId: 'proj', revisionId: 'v12', at: '2026-02-01T00:00:00Z', lines: currLines });
    const loadedPrev = store.load('proj', 'v9')!.lines;
    const loadedCurr = store.load('proj', 'v12')!.lines;
    const { summary } = diffIdentifiableLines(loadedPrev, loadedCurr);
    assert.equal(summary.qtyChanged, 1);
    closeRevisionDb();
    delete process.env.REVISIONS_DB;
  });
});

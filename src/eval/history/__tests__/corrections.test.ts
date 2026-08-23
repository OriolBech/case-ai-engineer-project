/**
 * Correcciones humanas: evidencia literal y el bucle de aprobación/promoción. Ver SPEC-010
 * §Aprendizaje supervisado y puntos 11-16.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeHistoryDb } from '../db.ts';
import { approveCorrection, getCorrection, promoteCorrection, proposeCorrection, rejectCorrection, type NewCorrection } from '../corrections.ts';
import { closeFinishDb } from '../../../rules/finish-db.ts';

let dir: string;

const NEW: NewCorrection = {
  runId: null,
  rowRef: '12',
  lineId: null,
  attribute: 'material',
  previousValue: 'AC',
  correctedValue: 'INOX',
  evidence: 'A4-70',
  author: 'Comprador',
  rationale: 'El comprador confirma que es A4, no genérico.',
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eval-history-corr-'));
  process.env.EVAL_HISTORY_DB = join(dir, 'h.sqlite');
  closeHistoryDb();
});

afterEach(() => {
  closeHistoryDb();
  delete process.env.EVAL_HISTORY_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe('evidencia literal', () => {
  test('se acepta cuando la evidencia aparece en la fila', () => {
    const id = proposeCorrection(NEW, 'PERNO A4-70 M10X50', '2026-08-23');
    assert.equal(getCorrection(id)?.status, 'PENDING');
  });

  test('se rechaza sin evidencia literal en la fila', () => {
    assert.throws(() => proposeCorrection(NEW, 'PERNO GENERICO M10X50', '2026-08-23'), /literalmente/);
  });

  test('se rechaza sin autor', () => {
    assert.throws(() => proposeCorrection({ ...NEW, author: '' }, 'A4-70', '2026-08-23'), /autor/);
  });

  test('se rechaza sin motivo', () => {
    assert.throws(() => proposeCorrection({ ...NEW, rationale: '' }, 'A4-70', '2026-08-23'), /motivo/);
  });

  test('se rechaza sin evidencia', () => {
    assert.throws(() => proposeCorrection({ ...NEW, evidence: '' }, 'A4-70', '2026-08-23'), /evidencia/);
  });
});

describe('el bucle permitido: propuesta -> aprobación -> promoción', () => {
  test('sólo se puede promocionar una corrección aprobada', () => {
    const id = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    assert.throws(() => promoteCorrection(id, true, 'ac-45h'), /APPROVED/);
    approveCorrection(id);
    assert.doesNotThrow(() => promoteCorrection(id, true, 'ac-45h'));
    assert.equal(getCorrection(id)?.status, 'PROMOTED');
    assert.equal(getCorrection(id)?.promotedEntryId, 'ac-45h');
  });

  test('una regresión no promociona: la corrección se queda en APPROVED, no vuelve a PENDING', () => {
    const id = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    approveCorrection(id);
    assert.throws(() => promoteCorrection(id, false, 'ac-45h'), /regresión/);
    assert.equal(getCorrection(id)?.status, 'APPROVED');
  });

  test('rechazada no se puede aprobar ni promocionar después', () => {
    const id = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    rejectCorrection(id);
    assert.throws(() => approveCorrection(id), /PENDING/);
    assert.throws(() => promoteCorrection(id, true, 'x'), /APPROVED/);
  });

  test('promoción de finish escribe en el vocabulario', () => {
    const finishDir = mkdtempSync(join(tmpdir(), 'finish-corr-'));
    copyFileSync(join('data', 'vocabulary', 'finish-alias.json'), join(finishDir, 'seed.json'));
    process.env.VOCAB_FINISH_DB = join(finishDir, 'v.sqlite');
    process.env.VOCAB_FINISH = join(finishDir, 'seed.json');
    process.env.VOCAB_FINISH_LOG = join(finishDir, 'log.jsonl');
    closeFinishDb();
    try {
      const id = proposeCorrection({
        runId: null,
        rowRef: '7',
        lineId: null,
        attribute: 'finish',
        previousValue: 'tropicalizado',
        correctedValue: 'CINCADO',
        evidence: 'tropicalizado',
        author: 'Comprador',
        rationale: 'Equivale a cincado según pliego.',
      }, 'Tornillo M16 tropicalizado', '2026-08-23');
      approveCorrection(id);
      assert.doesNotThrow(() => promoteCorrection(id, true, 'corr-finish-tropicalizado', '2026-08-23'));
      assert.equal(getCorrection(id)?.status, 'PROMOTED');
    } finally {
      closeFinishDb();
      delete process.env.VOCAB_FINISH_DB;
      delete process.env.VOCAB_FINISH;
      delete process.env.VOCAB_FINISH_LOG;
      rmSync(finishDir, { recursive: true, force: true });
    }
  });

  test('promoción de un atributo distinto de material/finish no está conectada', () => {
    const id = proposeCorrection({ ...NEW, attribute: 'standard', correctedValue: 'ISO 4014' }, 'A4-70', '2026-08-23');
    approveCorrection(id);
    assert.throws(() => promoteCorrection(id, true, 'x'), /material|finish/);
  });
});

describe('correcciones contradictorias', () => {
  test('dos correcciones sobre la misma fila y atributo con valores distintos permanecen pendientes hasta resolución explícita', () => {
    const id1 = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    const id2 = proposeCorrection({ ...NEW, correctedValue: 'AC' }, 'A4-70', '2026-08-23');
    assert.equal(getCorrection(id1)?.status, 'PENDING');
    assert.equal(getCorrection(id2)?.status, 'PENDING');

    approveCorrection(id1);
    assert.equal(getCorrection(id1)?.status, 'APPROVED');
    assert.equal(getCorrection(id2)?.status, 'PENDING', 'la contradictoria no cambia sola');
  });
});

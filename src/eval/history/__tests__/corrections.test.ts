/**
 * Correcciones humanas: evidencia literal y el bucle de aprobación/promoción. Ver SPEC-010
 * §Aprendizaje supervisado y puntos 11-16.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeHistoryDb } from '../db.ts';
import {
  approveCorrection,
  getCorrection,
  listCorrectionEvents,
  listValueConflicts,
  promoteCorrection,
  proposeCorrection,
  rejectCorrection,
  type NewCorrection,
} from '../corrections.ts';
import { orchestratePromotion } from '../promote.ts';
import { classifyPromotion } from '../../../domain/ports.ts';
import { closeFinishDb } from '../../../rules/finish-db.ts';
import { closeVocabularyDb } from '../../../rules/vocabulary-db.ts';
import { closeGenericAliasDb } from '../../../rules/generic-alias-db.ts';
import { normalizeName } from '../../../rules/names.ts';
import { normalizeQuality } from '../../../rules/quality.ts';
import { normalizeStandard } from '../../../rules/standards.ts';

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
  copyFileSync(
    join('data', 'vocabulary', 'material-derivation.json'),
    join(dir, 'material-seed.json'),
  );
  process.env.VOCAB_DB = join(dir, 'material.sqlite');
  process.env.VOCAB_MATERIAL = join(dir, 'material-seed.json');
  process.env.VOCAB_LOG = join(dir, 'material.log.jsonl');
  process.env.VOCAB_GENERIC_DB = join(dir, 'generic.sqlite');
  process.env.VOCAB_GENERIC_LOG = join(dir, 'generic.log.jsonl');
  closeHistoryDb();
  closeVocabularyDb();
  closeGenericAliasDb();
});

afterEach(() => {
  closeHistoryDb();
  closeVocabularyDb();
  closeGenericAliasDb();
  delete process.env.EVAL_HISTORY_DB;
  delete process.env.VOCAB_DB;
  delete process.env.VOCAB_MATERIAL;
  delete process.env.VOCAB_LOG;
  delete process.env.VOCAB_GENERIC_DB;
  delete process.env.VOCAB_GENERIC_LOG;
  rmSync(dir, { recursive: true, force: true });
});

describe('evidencia literal', () => {
  test('se acepta cuando la evidencia aparece en la fila', () => {
    const id = proposeCorrection(NEW, 'PERNO A4-70 M10X50', '2026-08-23');
    assert.equal(getCorrection(id)?.status, 'PENDING');
  });

  describe('migración explícita del histórico', () => {
    test('v1 conserva correcciones y añade auditoría/timestamps sin inventar datos', () => {
      closeHistoryDb();
      const legacy = new DatabaseSync(process.env.EVAL_HISTORY_DB!);
      legacy.exec(`
        CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO schema_meta VALUES ('version', '1');
        CREATE TABLE human_corrections (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          run_id TEXT,
          row_ref TEXT NOT NULL,
          line_id TEXT,
          attribute TEXT NOT NULL,
          previous_value TEXT,
          corrected_value TEXT,
          evidence TEXT NOT NULL,
          author TEXT NOT NULL DEFAULT '',
          rationale TEXT NOT NULL,
          status TEXT NOT NULL,
          promoted_entry_id TEXT
        );
        INSERT INTO human_corrections VALUES (
          'legacy-approved', '2026-01-01', NULL, '1', NULL, 'name', NULL, 'TORNILLO',
          'FIJADOR', 'Autor legado', 'decisión antigua', 'APPROVED', NULL
        );
      `);
      legacy.close();

      const migrated = getCorrection('legacy-approved');
      assert.equal(migrated?.status, 'APPROVED');
      assert.equal(migrated?.approvedAt, null, 'la migración no inventa la fecha desconocida');
      assert.deepEqual(
        listCorrectionEvents('legacy-approved').map((event) => event.action),
        ['PROPOSED', 'APPROVED'],
      );
    });
  });

  test('se rechaza sin evidencia literal en la fila', () => {
    assert.throws(() => proposeCorrection(NEW, 'PERNO GENERICO M10X50', '2026-08-23'), /literalmente/);
  });

  test('sin autor también se registra: no hay login', () => {
    const id = proposeCorrection({ ...NEW, author: '' }, 'A4-70', '2026-08-23');
    assert.equal(getCorrection(id)?.status, 'PENDING');
    assert.equal(getCorrection(id)?.author, '');
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
    assert.throws(() => promoteCorrection(id, true, 'ac-a4-alias', 'Promotor'), /APPROVED/);
    approveCorrection(id, 'Aprobador', '2026-08-24T10:00:00Z');
    assert.doesNotThrow(() =>
      promoteCorrection(id, true, 'ac-a4-alias', 'Promotor', '2026-08-24T11:00:00Z'),
    );
    assert.equal(getCorrection(id)?.status, 'PROMOTED');
    assert.equal(getCorrection(id)?.promotedEntryId, 'ac-a4-alias');
    assert.equal(getCorrection(id)?.approvedBy, 'Aprobador');
    assert.equal(getCorrection(id)?.promotedBy, 'Promotor');
    assert.deepEqual(
      listCorrectionEvents(id).map((event) => event.action),
      ['PROPOSED', 'APPROVED', 'PROMOTED'],
    );
  });

  test('una regresión no promociona: la corrección se queda en APPROVED, no vuelve a PENDING', () => {
    const id = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    approveCorrection(id, 'Aprobador');
    assert.throws(() => promoteCorrection(id, false, 'ac-45h', 'Promotor'), /regresión/);
    assert.equal(getCorrection(id)?.status, 'APPROVED');
  });

  test('rechazada no se puede aprobar ni promocionar después', () => {
    const id = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    rejectCorrection(id, 'Revisor');
    assert.throws(() => approveCorrection(id, 'Aprobador'), /PENDING/);
    assert.throws(() => promoteCorrection(id, true, 'x', 'Promotor'), /APPROVED/);
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
      approveCorrection(id, 'Aprobador');
      assert.doesNotThrow(() =>
        promoteCorrection(
          id,
          true,
          'corr-finish-tropicalizado',
          'Promotor',
          '2026-08-23T12:00:00Z',
        ),
      );
      assert.equal(getCorrection(id)?.status, 'PROMOTED');
    } finally {
      closeFinishDb();
      delete process.env.VOCAB_FINISH_DB;
      delete process.env.VOCAB_FINISH;
      delete process.env.VOCAB_FINISH_LOG;
      rmSync(finishDir, { recursive: true, force: true });
    }
  });

  test('promoción de norma escribe un alias de capa 2', () => {
    const id = proposeCorrection(
      {
        ...NEW,
        attribute: 'standard',
        previousValue: null,
        correctedValue: 'ISO 4014',
        evidence: 'NORMA CASA 14',
      },
      'PERNO NORMA CASA 14',
      '2026-08-23',
    );
    approveCorrection(id, 'Aprobador');
    assert.doesNotThrow(() =>
      promoteCorrection(id, true, 'standard-casa-14', 'Promotor', '2026-08-24T12:00:00Z'),
    );
    assert.equal(normalizeStandard('NORMA CASA 14')?.normalized, 'ISO 4014');
  });

  test('promoción de nombre y calidad escribe alias de capa 2', () => {
    const nameId = proposeCorrection(
      {
        ...NEW,
        attribute: 'name',
        previousValue: null,
        correctedValue: 'TORNILLO',
        evidence: 'FIJADOR CASA',
      },
      'FIJADOR CASA M10',
      '2026-08-23',
    );
    approveCorrection(nameId, 'Aprobador');
    promoteCorrection(nameId, true, 'name-fijador-casa', 'Promotor');

    const qualityId = proposeCorrection(
      {
        ...NEW,
        attribute: 'quality',
        previousValue: null,
        correctedValue: 'A4-70',
        evidence: 'Q-CASA',
      },
      'TORNILLO Q-CASA',
      '2026-08-23',
    );
    approveCorrection(qualityId, 'Aprobador');
    promoteCorrection(qualityId, true, 'quality-casa', 'Promotor');

    assert.equal(normalizeName('FIJADOR CASA')?.value, 'TORNILLO');
    assert.equal(normalizeQuality('Q-CASA').resolved, 'A4-70');
  });

  test('la promoción de calidad rechaza destinos fuera del catálogo del cliente', () => {
    const id = proposeCorrection(
      {
        ...NEW,
        attribute: 'quality',
        previousValue: null,
        correctedValue: 'CALIDAD INVENTADA',
        evidence: 'Q-CASA',
      },
      'TORNILLO Q-CASA',
      '2026-08-23',
    );
    approveCorrection(id, 'Aprobador');
    assert.throws(
      () => promoteCorrection(id, true, 'quality-invalid', 'Promotor'),
      /no pertenece al catálogo de calidad/,
    );
    assert.equal(getCorrection(id)?.status, 'APPROVED');
  });
});

describe('correcciones contradictorias', () => {
  test('dos correcciones sobre la misma fila y atributo con valores distintos permanecen pendientes hasta resolución explícita', () => {
    const id1 = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    const id2 = proposeCorrection({ ...NEW, correctedValue: 'AC' }, 'A4-70', '2026-08-23');
    assert.equal(getCorrection(id1)?.status, 'PENDING');
    assert.equal(getCorrection(id2)?.status, 'PENDING');

    approveCorrection(id1, 'Aprobador');
    assert.equal(getCorrection(id1)?.status, 'APPROVED');
    assert.equal(getCorrection(id2)?.status, 'PENDING', 'la contradictoria no cambia sola');
  });

  test('mismo span y valores distintos → un ValueConflict y classifyPromotion conflict', () => {
    proposeCorrection(NEW, 'A4-70', '2026-08-23');
    proposeCorrection({ ...NEW, correctedValue: 'AC' }, 'A4-70', '2026-08-23');
    const conflicts = listValueConflicts();
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.values.length, 2);
    assert.equal(classifyPromotion('material', true).kind, 'policy_decision');
    assert.equal(classifyPromotion('material', true).why, 'value_conflict');
  });

  test('ninguna corrección en conflicto se promociona', () => {
    const id1 = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    proposeCorrection({ ...NEW, correctedValue: 'AC' }, 'A4-70', '2026-08-23');
    approveCorrection(id1, 'Aprobador');
    assert.throws(
      () =>
        orchestratePromotion(id1, {
          regressionPassed: true,
          promotedEntryId: 'x',
          actor: 'Promotor',
        }),
      /conflicto/,
    );
    assert.equal(getCorrection(id1)?.status, 'APPROVED');
  });

  test('rechazar explícitamente la alternativa resuelve el conflicto sin borrar su traza', () => {
    const chosen = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    const rejected = proposeCorrection(
      { ...NEW, correctedValue: 'AC' },
      'A4-70',
      '2026-08-23',
    );
    approveCorrection(chosen, 'Aprobador');
    rejectCorrection(rejected, 'Responsable de vocabulario', '2026-08-24T13:00:00Z');
    assert.equal(listValueConflicts().length, 0);
    assert.equal(getCorrection(rejected)?.rejectedBy, 'Responsable de vocabulario');
    assert.deepEqual(
      listCorrectionEvents(rejected).map((event) => event.action),
      ['PROPOSED', 'REJECTED'],
    );
  });
});

describe('destino de promoción por atributo', () => {
  test('medida y longitud no van a vocabulario', () => {
    assert.equal(classifyPromotion('measure', false).kind, 'not_promotable');
    assert.equal(classifyPromotion('length', false).kind, 'not_promotable');
    const id = proposeCorrection(
      { ...NEW, attribute: 'measure', previousValue: 'M10', correctedValue: 'M12', evidence: 'M10' },
      'PERNO M10',
      '2026-08-23',
    );
    approveCorrection(id, 'Aprobador');
    assert.throws(
      () =>
        orchestratePromotion(id, {
          regressionPassed: true,
          promotedEntryId: 'x',
          actor: 'Promotor',
        }),
      /grammar|not_promotable/,
    );
  });

  test('orquestador exige regresión explícita', () => {
    const id = proposeCorrection(NEW, 'A4-70', '2026-08-23');
    approveCorrection(id, 'Aprobador');
    assert.throws(
      () =>
        orchestratePromotion(id, {
          regressionPassed: false,
          promotedEntryId: 'x',
          actor: 'Promotor',
        }),
      /regresión|eval/,
    );
  });

  test('cantidad tampoco genera alias', () => {
    const id = proposeCorrection(
      {
        ...NEW,
        attribute: 'quantity',
        previousValue: '10',
        correctedValue: '12',
        evidence: '10',
      },
      '10 TORNILLOS',
      '2026-08-23',
    );
    approveCorrection(id, 'Aprobador');
    assert.throws(
      () =>
        orchestratePromotion(id, {
          regressionPassed: true,
          promotedEntryId: 'quantity-x',
          actor: 'Promotor',
        }),
      /gold|vocabulario/,
    );
  });
});

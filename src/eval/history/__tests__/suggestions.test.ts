/**
 * Sugerencias de vocabulario y su KPI propio.
 *
 * Espeja el contrato del front (`SuggestionPatch { attribute: 'finish'|'material', match, value }`) y
 * su ciclo (aceptar -> validar, o descartar). Pinta las guardas que impiden que una sugerencia sea un
 * botón de autoresolver, y la forma de las dos cifras (aceptación · error silencioso de lo aprobado),
 * que es lo que se promete mientras no haya datos reales de comprador.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeHistoryDb } from '../db.ts';
import {
  acceptSuggestion, listSuggestions, recordSuggestion, rejectSuggestion, suggestionKpi,
  validateSuggestion, verifySuggestion, type NewSuggestion,
} from '../suggestions.ts';

let dir: string;

const ROW = 'Tornillo DIN 931 M20x100 A4-70 tropicalizado; tuerca DIN 934 A2';
// El material se sugiere desde la calidad (`A4-70`) — es el `match` que el front usa para casar la
// línea, y aparece literal en la fila; el valor propuesto sale del catálogo cerrado de calidades.
const NEW: NewSuggestion = {
  runId: null,
  rowRef: '63',
  lineId: '63.2',
  attribute: 'material',
  origin: 'closed_table',
  match: 'A4-70',
  value: 'INOX',
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eval-history-sugg-'));
  process.env.EVAL_HISTORY_DB = join(dir, 'h.sqlite');
  closeHistoryDb();
});

afterEach(() => {
  closeHistoryDb();
  delete process.env.EVAL_HISTORY_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe('las guardas que separan sugerencia de invención', () => {
  test('se registra cuando el match aparece en la fila', () => {
    const id = recordSuggestion(NEW, ROW, '2026-08-23');
    assert.equal(listSuggestions()[0].id, id);
    assert.equal(listSuggestions()[0].status, 'SHOWN');
  });

  test('se rechaza cuando el match no está literalmente en la fila', () => {
    assert.throws(() => recordSuggestion({ ...NEW, match: 'A4-80' }, ROW, '2026-08-23'), /literalmente/);
  });

  test('se rechaza sin match', () => {
    assert.throws(() => recordSuggestion({ ...NEW, match: '' }, ROW, '2026-08-23'), /match/);
  });

  test('se rechaza sin valor propuesto', () => {
    assert.throws(() => recordSuggestion({ ...NEW, value: '' }, ROW, '2026-08-23'), /valor/);
  });

  test('un atributo fuera del alcance del front es imposible de registrar', () => {
    assert.throws(
      () => recordSuggestion({ ...NEW, attribute: 'quality' as unknown as NewSuggestion['attribute'] }, ROW, '2026-08-23'),
      /alcance|finish/,
    );
  });

  test('un origen de llamada libre al modelo es imposible de registrar', () => {
    assert.throws(
      () => recordSuggestion({ ...NEW, origin: 'free_llm' as unknown as NewSuggestion['origin'] }, ROW, '2026-08-23'),
      /libre al modelo|inválido/,
    );
  });
});

describe('el ciclo mostrada -> aceptada -> validada (y la verificación aparte)', () => {
  test('sólo una MOSTRADA se acepta/descarta; sólo una ACEPTADA se valida', () => {
    const id = recordSuggestion(NEW, ROW, '2026-08-23');
    // No se puede validar ni verificar antes de aceptar: aún no hay nada aplicado.
    assert.throws(() => validateSuggestion(id, 'Comprador', '2026-08-24'), /ACEPTADA/);
    assert.throws(() => verifySuggestion(id, 'correct', 'QA', '2026-08-24'), /aprobada|ACCEPTED/);

    acceptSuggestion(id, 'Comprador', '2026-08-23');
    // Ya no está MOSTRADA: no se puede descartar ni re-aceptar.
    assert.throws(() => rejectSuggestion(id, 'Comprador', '2026-08-23'), /SHOWN/);

    validateSuggestion(id, 'Comprador', '2026-08-24');
    assert.equal(listSuggestions()[0].status, 'VALIDATED');

    // La validación del comprador NO es la verificación del KPI: el error silencioso sigue vivo.
    assert.doesNotThrow(() => verifySuggestion(id, 'wrong', 'QA', '2026-08-25'));
    assert.equal(listSuggestions()[0].verified, 'wrong');
  });

  test('una decisión se registra aunque no haya nombre: no hay login', () => {
    const id = recordSuggestion(NEW, ROW, '2026-08-23');
    assert.doesNotThrow(() => acceptSuggestion(id, '', '2026-08-23'));
  });
});

describe('la forma de las dos cifras', () => {
  test('cola vacía: 0/0 es null, no 0% — 0/0 no es 0%', () => {
    const k = suggestionKpi();
    assert.equal(k.shown, 0);
    assert.equal(k.acceptanceRate, null);
    assert.equal(k.silentErrorRate, null);
  });

  test('aceptación sobre lo decidido; error silencioso sobre lo aprobado-y-verificado', () => {
    const a = recordSuggestion(NEW, ROW, '2026-08-23');
    const b = recordSuggestion({ ...NEW, lineId: '63.3', match: 'A2', value: 'INOX' }, ROW, '2026-08-23');
    const c = recordSuggestion({ ...NEW, lineId: '63.4', attribute: 'finish', match: 'tropicalizado', value: 'CINCADO' }, ROW, '2026-08-23');

    acceptSuggestion(a, 'Comprador', '2026-08-23');
    acceptSuggestion(b, 'Comprador', '2026-08-23');
    validateSuggestion(b, 'Comprador', '2026-08-24'); // validada cuenta como aprobada
    rejectSuggestion(c, 'Comprador', '2026-08-23');
    // De las dos aprobadas, sólo una se ha verificado a ciegas, y salió mal.
    verifySuggestion(a, 'wrong', 'QA', '2026-08-24');

    const k = suggestionKpi();
    assert.equal(k.shown, 3);
    assert.equal(k.pending, 0);
    assert.equal(k.accepted, 2, 'aprobadas = aceptada + validada');
    assert.equal(k.validated, 1);
    assert.equal(k.rejected, 1);
    assert.equal(k.acceptanceRate, 2 / 3, 'aceptación = aprobadas / decididas');
    assert.equal(k.acceptedVerified, 1);
    assert.equal(k.acceptedWrong, 1);
    assert.equal(k.silentErrorRate, 1, 'error silencioso = 1 mala de 1 verificada, no de 2 aprobadas');
  });

  test('el desglose por atributo no promedia: cada atributo lleva sus cifras', () => {
    const m = recordSuggestion(NEW, ROW, '2026-08-23');
    const f = recordSuggestion({ ...NEW, attribute: 'finish', match: 'tropicalizado', value: 'CINCADO' }, ROW, '2026-08-23');
    acceptSuggestion(m, 'Comprador', '2026-08-23');
    rejectSuggestion(f, 'Comprador', '2026-08-23');

    const k = suggestionKpi();
    assert.equal(k.perAttribute.material.acceptanceRate, 1);
    assert.equal(k.perAttribute.finish.acceptanceRate, 0);
  });
});

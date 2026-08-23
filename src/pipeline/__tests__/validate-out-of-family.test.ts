/**
 * P-9 · La fila que no es tornillería, y a quién NO se le manda.
 *
 * El enunciado no dice nada de esto: ni el PDF ni `reglas_tornilleria.md` contemplan que en el MTO
 * llegue una brida, y ni siquiera está en la §10 de ambigüedades declaradas. Es decisión propia, y
 * la parte de la decisión que este test protege es la segunda mitad, la que costó ver:
 *
 * apartar la fila no basta —hay que apartarla a la cola correcta—. Con `MISSING_IN_SOURCE` la brida
 * caía en "vuelve a ingeniería", y eso es falso: a la fila no le falta ningún dato, está completa y
 * bien escrita, sólo que no es de esta familia. Ingeniería no tiene nada que arreglar y la
 * devolvería, y mientras tanto es ruido en la única cola que el enunciado dice explícitamente que
 * hay que mantener limpia ("si la cola se llena de ruido el comprador deja de mirarla").
 *
 * El `kind` es lo que enruta en el front (`app/lib/derive.ts`), así que el `kind` es lo que se mide.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow } from '../validate.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

const row: MtoRow = {
  itemRef: '56',
  sourceText: 'BRIDA SLIP-ON 6" 150# ASTM A105',
  cellOffsets: {}, quantity: 12, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: 57,
};

const outOfFamily: Analysis = {
  rowRef: '56', outOfFamily: true, outOfFamilyReason: 'Es una brida, no tornillería',
  elements: [], hallucinations: [], rejectedMultiplicity: [], skippedLlm: false,
  tier: 'main', escalated: false, error: null,
};

describe('P-9 · fuera de familia', () => {
  test('sale una línea, no cero: una fila que desaparece no se puede cuadrar contra el Excel', () => {
    const lines = validateRow(outOfFamily, [], row);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].rowRef, '56');
    assert.equal(lines[0].status, 'REVISION_MANUAL');
  });

  test('no se le inventa ni un atributo: el modo de fallo caro es una brida RESUELTA', () => {
    const [line] = validateRow(outOfFamily, [], row);
    for (const a of Object.values(line.attributes)) {
      assert.equal(a.normalized, null);
      assert.equal(a.provenance, 'absent');
    }
  });

  test('el motivo es OUT_OF_SCOPE, no MISSING_IN_SOURCE: no es cosa de ingeniería', () => {
    const [line] = validateRow(outOfFamily, [], row);
    const reason = line.reasons.find((r) => r.code === 'OUT_OF_FAMILY');
    assert.ok(reason, 'la línea tiene que decir por qué se aparta');
    assert.equal(reason.kind, 'OUT_OF_SCOPE');
    assert.ok(
      !line.reasons.some((r) => r.kind === 'MISSING_IN_SOURCE'),
      'ni un solo motivo puede ser MISSING_IN_SOURCE, o el front la manda a ingeniería',
    );
    assert.match(reason.message, /brida/, 'el motivo del modelo viaja con la línea, para la traza');
  });

  test('la política alternativa la descarta en silencio, y sólo esa', () => {
    const lines = validateRow(outOfFamily, [], row, { policies: { outOfFamily: 'silent_skip' } as never });
    assert.equal(lines.length, 0);
  });
});

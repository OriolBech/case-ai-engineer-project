/**
 * La cola efectiva, y sobre todo el camino de vuelta.
 *
 * LA INVARIANTE QUE FIJA ESTE FICHERO:
 *
 *   **Una línea devuelta a revisión no se pide.** Cae del export RFQ y del % resueltas a la vez, y
 *   por la misma razón: las dos cifras responden a la misma pregunta —qué se manda a pedir hoy—, y
 *   que una diga que sí y la otra que no es la clase de desacuerdo que se descubre cuando ya se ha
 *   comprado el material.
 *
 * El caso existe porque el sistema puede equivocarse en la dirección cara: dar por buena una línea
 * que no lo está. Sin salida, quien lo detecta exporta el CSV y lo arregla en Excel, que es
 * exactamente lo que el enunciado pide quitar.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveQueue, queueOf } from '../derive.ts';
import type { Attribute, OutputLine, Provenance, Reason } from '../../../src/pipeline/types.ts';

const attr = (
  normalized: string | null,
  provenance: Provenance = 'extracted',
): Attribute => ({ raw: normalized, normalized, provenance, span: null, rule: null } as Attribute);

function line(id: string, status: OutputLine['status'], reasons: Reason[] = []): OutputLine {
  return {
    id,
    rowRef: id.split('.')[0]!,
    status,
    attributes: {
      name: attr('ESPARRAGO'),
      material: attr('AC'),
      quality: attr('8.8'),
      measure: attr('M16'),
      length: attr('60 mm'),
      standard: attr('DIN 931'),
      finish: attr(null, 'absent'),
    },
    quantity: 10,
    quantityProvenance: 'extracted',
    reasons,
    confidence: 0.9,
    policiesApplied: [],
  } as OutputLine;
}

const outOfScope: Reason[] = [
  { code: 'OUT_OF_SCOPE', kind: 'OUT_OF_SCOPE', message: 'No es tornillería', attribute: null } as unknown as Reason,
];

const none: ReadonlySet<string> = new Set();

describe('effectiveQueue · lo que decide una persona', () => {
  test('sin nada decidido, manda el pipeline', () => {
    assert.equal(effectiveQueue(line('1.1', 'RESUELTA'), none, none), 'resuelta');
    assert.equal(effectiveQueue(line('2.1', 'REVISION_MANUAL'), none, none), 'revision');
  });

  test('validar una línea en revisión la pasa a resuelta', () => {
    const l = line('2.1', 'REVISION_MANUAL');
    assert.equal(effectiveQueue(l, new Set(['2.1']), none), 'resuelta');
  });

  test('devolver una RESUELTA del pipeline la saca de resueltas', () => {
    const l = line('1.1', 'RESUELTA');
    assert.equal(queueOf(l), 'resuelta', 'el pipeline sigue diciendo lo que decía');
    assert.equal(effectiveQueue(l, none, new Set(['1.1'])), 'revision');
  });

  test('devolver manda sobre validar: es la última palabra de quien compra', () => {
    const l = line('2.1', 'REVISION_MANUAL');
    assert.equal(effectiveQueue(l, new Set(['2.1']), new Set(['2.1'])), 'revision');
  });

  test('una fila de otra familia no se devuelve: no es una cola de trabajo (P-9)', () => {
    const l = line('9.1', 'REVISION_MANUAL', outOfScope);
    assert.equal(effectiveQueue(l, none, new Set(['9.1'])), 'fuera-familia');
    assert.equal(effectiveQueue(l, new Set(['9.1']), none), 'fuera-familia');
  });

  test('el tercer argumento es opcional: las llamadas antiguas no cambian de significado', () => {
    assert.equal(effectiveQueue(line('1.1', 'RESUELTA'), none), 'resuelta');
    assert.equal(effectiveQueue(line('2.1', 'REVISION_MANUAL'), new Set(['2.1'])), 'resuelta');
  });
});

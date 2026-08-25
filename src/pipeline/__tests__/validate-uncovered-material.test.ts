/**
 * P-13 · la calidad que nadie ha decidido no puede salir lista para pedir.
 *
 * EL FALLO QUE ESTOS TESTS FIJAN. La respuesta que se le dio al cliente en la Q3 tiene dos mitades:
 *
 *   > Cualquier calidad **no cubierta o no unívoca** irá a revisión.
 *
 * El validador aplicaba la segunda —dos entradas en conflicto mandaban la línea a revisión— y no la
 * primera. Una calidad que ninguna entrada cubría dejaba el material vacío, el hueco se iba al
 * backlog de decisiones… y la línea salía **RESUELTA**, entraba en el CSV de RFQ y se compraba sin
 * saber si la pieza era acero o inoxidable. Medido sobre `MTO_sugerencias.xlsx`: 6 líneas de 42,
 * todas ellas con una calidad que nadie había decidido (`GR L7`, `GR B8`, `GR 12H`, `GR B8M`,
 * `GR 660`).
 *
 * El razonamiento que lo produjo tenía una mitad buena: un hueco de política **no** es trabajo del
 * comprador de revisar dato a dato, así que va al backlog y no a su cola. La mitad mala es el salto
 * de ahí a "por tanto la línea puede darse por resuelta". Son dos canales distintos —dónde se decide
 * y en qué estado sale la línea— y confundirlos es exactamente el default disparándose en silencio
 * que `policies.ts` existe para evitar. P-12 ya había sentado el precedente con el acabado.
 *
 * Lo que NO cambia: una ausencia **decidida** (`200HV` — una dureza describe el tratamiento
 * superficial, no el metal base) sigue siendo un valor válido y resuelto. Distinguir "nadie lo ha
 * mirado" de "se miró y se decidió que no se puede derivar" es el objeto de estos tests.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow } from '../validate.ts';
import { detectGaps, policyBacklog } from '../coverage.ts';
import { normalizeElement, type NormalizedElement } from '../normalize.ts';
import { DEFAULT_POLICIES } from '../../rules/policies.ts';
import { queueOf } from '../../../app/lib/derive.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

const row = (itemRef: string, sourceText: string): MtoRow => ({
  itemRef,
  sourceText,
  cellOffsets: {}, quantity: 100, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: Number(itemRef) + 1,
});

const analysis = (rowRef: string, n: number): Analysis => ({
  rowRef, outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], rejectedMultiplicity: [], skippedLlm: false,
  tier: 'main', escalated: false, error: null,
});

/** Un tornillo completo salvo el material, que es justo lo que se deriva de la calidad. */
function bolt(quality: string): NormalizedElement {
  const v = (value: string | null) =>
    ({ value, span: value ? { start: 0, end: value.length } : null, hallucinated: false });
  return normalizeElement({
    detectedName: 'ESPARRAGO', normalizedName: 'ESPARRAGO', role: 'principal',
    span: { start: 0, end: 9 }, multiplicity: 1, multiplicityStated: false,
    attributes: {
      material: v(null), quality: v(quality), measure: v('M16'),
      length: v('60 mm'), standard: v('ASTM A320'), finish: v(null),
    },
  } as never);
}

const UNCOVERED = 'GR 12H';   // ninguna entrada del vocabulario la cubre
const COVERED = '8.8';        // deriva a AC por `ac-clase-8-8`
const DELIBERATE = '200HV';   // declarada NO derivable, con su motivo escrito

describe('P-13 · calidad no cubierta por el vocabulario de material', () => {
  test('con review (default) la línea va a revisión en vez de salir lista para pedir', () => {
    const r = row('23', 'Esparrago ASTM A320 M16x60, GR 12H');
    const [line] = validateRow(analysis('23', 1), [bolt(UNCOVERED)], r);

    assert.equal(line.attributes.material.normalized, null, 'el material sigue vacío: no se inventa');
    assert.equal(line.status, 'REVISION_MANUAL');
    assert.equal(queueOf(line), 'revision');
    const reason = line.reasons.find((x) => x.attribute === 'material');
    assert.ok(reason, 'la línea dice POR QUÉ, no solo que está pendiente');
    assert.equal(reason!.code, 'UNMAPPED_VALUE');
    assert.match(reason!.message, /acero o inoxidable/);
    assert.ok(line.policiesApplied.includes('P-13'));
  });

  test('con resolve vuelve el comportamiento anterior, y así su delta es medible', () => {
    const r = row('23', 'Esparrago ASTM A320 M16x60, GR 12H');
    const [line] = validateRow(analysis('23', 1), [bolt(UNCOVERED)], r, {
      policies: { ...DEFAULT_POLICIES, uncoveredMaterial: 'resolve' },
    });
    assert.equal(line.status, 'RESUELTA');
    assert.equal(line.reasons.filter((x) => x.attribute === 'material').length, 0);
  });

  test('una calidad CUBIERTA no se ve afectada: deriva y resuelve', () => {
    const r = row('1', 'Tornillo DIN 933 M16x60, 8.8');
    const [line] = validateRow(analysis('1', 1), [bolt(COVERED)], r);
    assert.equal(line.attributes.material.normalized, 'AC');
    assert.equal(line.status, 'RESUELTA');
  });

  test('una ausencia DECIDIDA sigue siendo válida y resuelta, y dice que lo es', () => {
    // 200HV: la tabla declara que una dureza describe el tratamiento superficial y no el metal base,
    // así que derivar aquí sería inventar. Eso NO es un hueco: es una decisión tomada. La regla en el
    // atributo es lo que permite al comprador distinguirla de "nadie lo ha mirado todavía".
    const r = row('30', 'Arandela DIN 125 M16, 200HV');
    const [line] = validateRow(analysis('30', 1), [bolt(DELIBERATE)], r);

    assert.equal(line.attributes.material.normalized, null);
    assert.equal(line.attributes.material.rule, 'P-3:no-derivable');
    assert.equal(line.status, 'RESUELTA');
    assert.equal(line.reasons.filter((x) => x.attribute === 'material').length, 0);
  });
});

describe('los dos canales siguen siendo dos', () => {
  test('la línea va a revisión Y el hueco sigue yendo al backlog', () => {
    // Lo que cambia es el ESTADO de la línea, no dónde se toma la decisión: el alta de vocabulario
    // se sigue decidiendo una vez, no una por fila.
    const r = row('23', 'Esparrago ASTM A320 M16x60, GR 12H');
    const lines = validateRow(analysis('23', 1), [bolt(UNCOVERED)], r);

    assert.equal(lines[0].status, 'REVISION_MANUAL');
    const gaps = detectGaps(r, lines).filter((g) => g.kind === 'UNCOVERED_DERIVATION');
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].value, UNCOVERED);
  });

  test('la misma calidad en varias filas es UNA decisión, y N líneas en revisión', () => {
    const refs = ['21', '22', '23'];
    const all = refs.map((ref) => {
      const r = row(ref, 'Esparrago ASTM A320 M16x60, GR 12H');
      const lines = validateRow(analysis(ref, 1), [bolt(UNCOVERED)], r);
      return { r, lines };
    });

    assert.ok(all.every(({ lines }) => lines[0].status === 'REVISION_MANUAL'));
    const backlog = policyBacklog(all.flatMap(({ r, lines }) => detectGaps(r, lines)))
      .filter((b) => b.kind === 'UNCOVERED_DERIVATION');
    assert.equal(backlog.length, 1, 'una sola entrada de backlog');
    assert.deepEqual(backlog[0].rows, refs);
  });
});

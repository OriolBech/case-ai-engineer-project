/**
 * P-10 · el número desnudo que no era una medida, y P-11 · lo que resultó ser.
 *
 * La fila 63 del set sintético: `Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10,
 * 2 arandelas DIN 125 200HV, zincado`. El extractor metió la CALIDAD de la tuerca (`10`) y el
 * número de la NORMA de la arandela (el `125` de `DIN 125`) en el campo medida.
 *
 * Lo que hace que esto merezca un test y no un parche: **pasó todas las defensas que había**. La
 * verificación de spans aprueba, porque los dígitos están literalmente en la fila. La confianza
 * salió 0,95, porque cada valor se leyó al pie de la letra. `detectGaps` recorre nombres, normas,
 * acabados y calidades, no medidas. Y el crítico ni siquiera llegó a correr (ver critic.test.ts).
 * La arandela estaba a un flag de política de salir RESUELTA con medida 125.
 *
 * La corrección no usa modelo: §6 dice que una medida es pulgadas o métrica y que NO hay
 * equivalencia entre las dos, y §2 dice que la medida es lo único que viaja dentro de un set.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow } from '../validate.ts';
import { normalizeElement, type NormalizedElement } from '../normalize.ts';
import { DEFAULT_POLICIES } from '../../rules/policies.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

const row: MtoRow = {
  itemRef: '63',
  sourceText: 'Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado',
  cellOffsets: {}, quantity: 30, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: 64,
};

const analysis = (n: number): Analysis => ({
  rowRef: '63', outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], rejectedMultiplicity: [], skippedLlm: false,
  tier: 'main', escalated: false, error: null,
});

interface Spec {
  name: string;
  role: 'principal' | 'secondary';
  measure: string | null;
  quality?: string | null;
  standard?: string | null;
  length?: string | null;
}

function element(o: Spec): NormalizedElement {
  const v = (value: string | null | undefined) =>
    ({ value: value ?? null, span: value ? { start: 0, end: value.length } : null, hallucinated: false });
  return normalizeElement({
    detectedName: o.name, normalizedName: o.name, role: o.role,
    span: { start: 0, end: o.name.length }, multiplicity: 1, multiplicityStated: false,
    attributes: {
      material: v(null), quality: v(o.quality), measure: v(o.measure),
      length: v(o.length), standard: v(o.standard), finish: v(null),
    },
  } as never);
}

const bolt = (): Spec => ({ name: 'TORNILLO', role: 'principal', measure: 'M20x100', quality: '8.8', standard: 'DIN 931' });

describe('P-10 · un número desnudo no es una medida cuando la fila demuestra otra cosa', () => {
  test('la medida falsa se descarta y §2 pone la buena', () => {
    const els = [element(bolt()), element({ name: 'TUERCA', role: 'secondary', measure: '10', standard: 'DIN 934' })];
    const lines = validateRow(analysis(2), els, row);
    assert.equal(lines[0].attributes.measure.normalized, 'M20');
    assert.equal(lines[1].attributes.measure.normalized, 'M20');
    assert.equal(lines[1].attributes.measure.provenance, 'extrapolated');
    assert.ok(lines[1].policiesApplied.includes('P-10'));
  });

  test('el valor descartado queda en la traza: el challenge pide la traza por atributo', () => {
    const els = [element(bolt()), element({ name: 'TUERCA', role: 'secondary', measure: '10', standard: 'DIN 934' })];
    const [, nut] = validateRow(analysis(2), els, row);
    assert.match(nut.attributes.measure.rule ?? '', /P-10 descartó "10"/);
  });

  test('una fila de un solo elemento no se toca: el 4.8 de un DIN 7981 SÍ es la medida', () => {
    const els = [element({ name: 'TORNILLO', role: 'principal', measure: '4.8x25', quality: 'A2', standard: 'DIN 7981' })];
    const [line] = validateRow(analysis(1), els, row);
    assert.equal(line.attributes.measure.normalized, '4.8');
    assert.equal(line.attributes.measure.provenance, 'extracted');
    assert.ok(!line.policiesApplied.includes('P-10'));
  });

  test('sin ningún ancla bien formada no se descarta nada: no hay con qué contradecirlo', () => {
    const els = [
      element({ name: 'TORNILLO', role: 'principal', measure: '4.8x25', standard: 'DIN 7981' }),
      element({ name: 'TUERCA', role: 'secondary', measure: '10', standard: 'DIN 934' }),
    ];
    const lines = validateRow(analysis(2), els, row);
    assert.equal(lines[1].attributes.measure.normalized, '10');
  });

  test('la política se puede apagar y se ve el comportamiento anterior', () => {
    const els = [element(bolt()), element({ name: 'TUERCA', role: 'secondary', measure: '10', standard: 'DIN 934' })];
    const lines = validateRow(analysis(2), els, row, {
      policies: { ...DEFAULT_POLICIES, bareMeasureInSet: 'keep' },
    });
    assert.equal(lines[1].attributes.measure.normalized, '10');
  });
});

describe('P-11 · lo que el valor descartado resulta ser', () => {
  test('"10" en una TUERCA es la calidad G9, y la tabla lo dice sin preguntarle a nadie', () => {
    const els = [element(bolt()), element({ name: 'TUERCA', role: 'secondary', measure: '10', standard: 'DIN 934' })];
    const [, nut] = validateRow(analysis(2), els, row);
    assert.equal(nut.attributes.quality.normalized, '10');
    assert.match(nut.attributes.quality.rule ?? '', /^P-11:quality_from_rejected_measure:G9$/);
    assert.ok(!nut.reasons.some((r) => r.code === 'QUALITY_MISSING'),
      'pedirle a ingeniería un dato que la fila escribe es ruido en la cola que menos ruido admite');
    assert.ok(nut.policiesApplied.includes('P-11'));
  });

  test('"125" no está en ningún catálogo: se descarta y no se inventa nada', () => {
    const els = [element(bolt()), element({ name: 'ARANDELA', role: 'secondary', measure: '125', quality: '200HV', standard: 'DIN 125' })];
    const [, washer] = validateRow(analysis(2), els, row);
    assert.equal(washer.attributes.measure.normalized, 'M20');
    assert.equal(washer.attributes.quality.normalized, '200HV', 'su calidad de verdad no se toca');
  });

  test('no se recupera una calidad incoherente con el tipo: fabricaríamos la incoherencia', () => {
    // '10' es G9, y §5 restringe G8/G9 a tuercas. En un TORNILLO no es su calidad: es otra cosa.
    const els = [
      element({ name: 'ESPARRAGO', role: 'principal', measure: 'M20x100', quality: '8.8', standard: 'DIN 976' }),
      element({ name: 'TORNILLO', role: 'secondary', measure: '10', standard: 'DIN 931' }),
    ];
    const [, screw] = validateRow(analysis(2), els, row);
    assert.equal(screw.attributes.measure.normalized, 'M20');
    assert.equal(screw.attributes.quality.normalized, null);
    assert.ok(screw.reasons.some((r) => r.code === 'QUALITY_MISSING'));
    assert.ok(!screw.reasons.some((r) => r.code === 'QUALITY_TYPE_INCOHERENCE'));
  });

  test('no se pisa una calidad que el elemento ya tiene', () => {
    const els = [element(bolt()), element({ name: 'TUERCA', role: 'secondary', measure: '10', quality: '8', standard: 'DIN 934' })];
    const [, nut] = validateRow(analysis(2), els, row);
    assert.equal(nut.attributes.quality.normalized, '8');
  });

  test('con P-11 apagada, la medida se descarta igual pero la calidad no se recupera', () => {
    const els = [element(bolt()), element({ name: 'TUERCA', role: 'secondary', measure: '10', standard: 'DIN 934' })];
    const [, nut] = validateRow(analysis(2), els, row, {
      policies: { ...DEFAULT_POLICIES, rejectedMeasureAsQuality: 'off' },
    });
    assert.equal(nut.attributes.measure.normalized, 'M20');
    assert.equal(nut.attributes.quality.normalized, null);
  });
});

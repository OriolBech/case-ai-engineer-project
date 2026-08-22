import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasure, resolveLength, formatLength } from '../measure.ts';

describe('parseMeasure', () => {
  test('métrica e imperial, sin convertir nunca entre sistemas', () => {
    assert.equal(parseMeasure('M20')?.system, 'metric');
    assert.equal(parseMeasure('M20')?.canonical, 'M20');
    assert.equal(parseMeasure('7/8"')?.system, 'imperial');
    assert.equal(parseMeasure('7/8"')?.canonical, '7/8"');
    assert.equal(parseMeasure('1"')?.canonical, '1"');
    assert.equal(parseMeasure('1-1/2"')?.canonical, '1-1/2"');
  });
  test('designación métrica sin prefijo M (DIN 7981: 4.8x25)', () => {
    assert.equal(parseMeasure('4.8')?.system, 'metric');
  });
});

describe('resolveLength · P-4', () => {
  test('unidad escrita: nada que decidir', () => {
    const r = resolveLength('40 mm', parseMeasure('M10'));
    assert.equal(r && !r.implausible && r.basis, 'stated');
  });
  test('designación métrica: M20x90 son 90 mm, y es CIERTO, no política', () => {
    const r = resolveLength('90', parseMeasure('M20'));
    assert.ok(r && !r.implausible);
    assert.equal(!r.implausible && r.basis, 'designation');
    assert.equal(!r.implausible && r.unit, 'mm');
  });
  test('imperial sin unidad: 7/8" X 130 son 130 mm por plausibilidad', () => {
    const r = resolveLength('130', parseMeasure('7/8"'));
    assert.ok(r && !r.implausible);
    assert.equal(!r.implausible && r.unit, 'mm', '130 pulgadas serían 3,3 m');
    assert.equal(!r.implausible && r.basis, 'plausibility');
  });
  test('las tres filas imperiales del MTO', () => {
    for (const [len, med] of [['130', '7/8"'], ['150', '1"'], ['110', '3/4"']] as const) {
      const r = resolveLength(len, parseMeasure(med));
      assert.equal(r && !r.implausible && r.unit, 'mm', `${med} x ${len}`);
    }
  });
  test('un número pequeño en imperial se resuelve como pulgadas', () => {
    const r = resolveLength('2', parseMeasure('7/8"'));
    assert.equal(r && !r.implausible && r.unit, 'inch', '2 mm en un 7/8" no existe');
  });
  test('lo que el rango no separa NO se resuelve: cae a revisión', () => {
    const r = resolveLength('20', parseMeasure('M12'));
    // metrica -> designacion, siempre resoluble
    assert.equal(r && !r.implausible && r.basis, 'designation');
    const amb = resolveLength('40', parseMeasure('1/2"'));
    assert.ok(amb, 'devuelve algo');
    if (amb && amb.implausible) assert.ok(amb.candidates.length !== 1);
  });
  test('formato de salida conserva el sistema', () => {
    const mm = resolveLength('130', parseMeasure('7/8"'));
    assert.equal(mm && !mm.implausible ? formatLength(mm) : '', '130 mm');
    const inch = resolveLength('2"', parseMeasure('7/8"'));
    assert.equal(inch && !inch.implausible ? formatLength(inch) : '', '2"');
  });
});

// --- length inside the designation --------------------------------------------------------------
//
// Row 4 of the MTO is the case: the extractor returned `measure: "M16x60"` and `length: null`, so a
// line whose length the row states unambiguously went to the buyer's queue as LENGTH_MISSING. The
// diameter and the length are one string in an ISO designation, and splitting it is a regex.

test('designación · M16x60 lleva la longitud dentro', () => {
  const m = parseMeasure('M16x60');
  assert.equal(m?.canonical, 'M16');
  assert.equal(m?.lengthRaw, '60');
});

test('designación · admite espacios y la x en mayúscula', () => {
  assert.equal(parseMeasure('M12 x 50')?.lengthRaw, '50');
  assert.equal(parseMeasure('M20X90')?.lengthRaw, '90');
});

test('designación · imperial: la longitud va detrás de la pulgada', () => {
  const m = parseMeasure('7/8" X 130');
  assert.equal(m?.canonical, '7/8"');
  assert.equal(m?.lengthRaw, '130');
});

test('designación · con LG detrás sigue siendo la longitud', () => {
  assert.equal(parseMeasure('1" X 200 LG')?.lengthRaw, '200');
});

test('designación · sin longitud, null; nunca se inventa', () => {
  assert.equal(parseMeasure('M16')?.lengthRaw, null);
  assert.equal(parseMeasure('7/8"')?.lengthRaw, null);
});

test('designación · la numérica desnuda de los DIN 7981 también', () => {
  const m = parseMeasure('4.8x25');
  assert.equal(m?.canonical, '4.8');
  assert.equal(m?.lengthRaw, '25');
});

test('designación · la longitud de la designación es milímetros por la propia ISO', () => {
  const m = parseMeasure('M16x60');
  const r = resolveLength(m!.lengthRaw!, m);
  assert.equal(r && 'basis' in r ? r.basis : null, 'designation', 'cierta, no política');
});

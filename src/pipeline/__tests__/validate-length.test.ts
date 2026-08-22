/**
 * The length that lives inside the designation, and the invariant it nearly broke.
 *
 * `M16x60` is one string holding a diameter and a length. Reading the length out of it closes a
 * real hole (row 4 of the gold went to review on a length the row states). Reading it out of an
 * EXTRAPOLATED measure would open a worse one: §2 allows the measure to travel across a set and
 * nothing else, so a nut inheriting `M16x60` must not inherit the 60 with it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow } from '../validate.ts';
import { normalizeElement, type NormalizedElement } from '../normalize.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

const row: MtoRow = {
  itemRef: '4',
  sourceText: 'BOLT DIN933 M16x60 with BOLT DIN931',
  cellOffsets: {}, quantity: 100, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: 2,
};

const analysis = (n: number): Analysis => ({
  rowRef: '4', outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], rejectedMultiplicity: [], skippedLlm: false,
  tier: 'main', escalated: false, error: null,
});

/** A normalized element built the way normalizeElement does, from raw model values. */
function element(over: { name: string; measure: string | null; length?: string | null }): NormalizedElement {
  const v = (value: string | null) => ({ value, span: value ? { start: 0, end: value.length } : null, hallucinated: false });
  return normalizeElement({
    detectedName: over.name, normalizedName: over.name, role: 'principal',
    span: { start: 0, end: 4 }, multiplicity: 1, multiplicityStated: false,
    attributes: {
      material: v(null), quality: v('8.8'), measure: v(over.measure),
      length: v(over.length ?? null), standard: v('DIN 933'), finish: v(null),
    },
  } as never);
}

describe('longitud desde la designación', () => {
  test('M16x60 sin campo length resuelve la longitud, no la manda a revisión', () => {
    const el = element({ name: 'TORNILLO', measure: 'M16x60' });
    const [line] = validateRow(analysis(1), [el], row);
    assert.equal(line.attributes.length.normalized, '60 mm');
    // Por la designación ISO: cierta, no política P-4.
    assert.equal(line.attributes.length.provenance, 'extracted');
    assert.ok(!line.reasons.some((r) => r.code === 'LENGTH_MISSING'));
  });

  test('un length extraído gana a la designación', () => {
    const el = element({ name: 'TORNILLO', measure: 'M16x60', length: '70 mm' });
    const [line] = validateRow(analysis(1), [el], row);
    assert.equal(line.attributes.length.normalized, '70 mm');
  });

  test('la longitud NO viaja con una medida extrapolada', () => {
    // §2: sólo la medida se extrapola. Si el segundo tornillo hereda `M16x60`, hereda el diámetro,
    // nunca el 60 que va dentro de la cadena.
    const principal = element({ name: 'TORNILLO', measure: 'M16x60' });
    const secondary = element({ name: 'TORNILLO', measure: null });
    const lines = validateRow(analysis(2), [principal, { ...secondary, role: 'secondary' }], row);
    assert.equal(lines[1].attributes.measure.provenance, 'extrapolated', 'la medida sí se hereda');
    assert.equal(lines[1].attributes.length.normalized, null, 'la longitud no');
    assert.ok(lines[1].reasons.some((r) => r.code === 'LENGTH_MISSING'));
  });

  test('una tuerca sigue exenta de longitud aunque la designación traiga una', () => {
    const el = element({ name: 'TUERCA', measure: 'M16x60' });
    const [line] = validateRow(analysis(1), [el], row);
    assert.equal(line.attributes.length.normalized, 'N/A');
    assert.equal(line.attributes.length.provenance, 'not_applicable');
  });
});

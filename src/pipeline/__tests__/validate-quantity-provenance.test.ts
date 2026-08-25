/**
 * De dónde sale la cantidad, y cuándo eso es un supuesto.
 *
 * LA INVARIANTE QUE FIJA ESTE FICHERO:
 *
 *   **Un supuesto que no puede cambiar el número no puede degradar su procedencia.**
 *
 * P-2 asume una pieza por conjunto cuando la fila no lo dice. Para un elemento SECUNDARIO ese
 * supuesto es real —`with NUT` no dice si es una tuerca o dos— y la cantidad sale `inferred`, con
 * su marca. Para el PRINCIPAL no lo es: la columna de cantidad cuenta el artículo del que va la
 * fila, y no hay lectura de `STUD BOLT ... 40 uds` en la que los espárragos no sean 40.
 *
 * Marcarlo `inferred` ponía el punto de "esto es un supuesto" en nueve de las treinta líneas del MTO
 * del enunciado —todas las cabeceras de set— por un factor de 1 que no mueve nada, y discrepaba del
 * gold en las nueve.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow } from '../validate.ts';
import { normalizeElement, type NormalizedElement } from '../normalize.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

const row: MtoRow = {
  itemRef: '1',
  sourceText: 'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H',
  cellOffsets: {}, quantity: 40, quantityColumn: 'CANT.', unit: 'uds', sheet: 'MTO', rowNumber: 5,
};

const analysis = (n: number): Analysis => ({
  rowRef: '1', outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], rejectedMultiplicity: [], skippedLlm: false,
  tier: 'main', escalated: false, error: null,
});

function element(over: {
  name: string;
  role: 'principal' | 'secondary';
  multiplicity?: number;
  multiplicityStated?: boolean;
}): NormalizedElement {
  const v = (value: string | null) => ({ value, span: value ? { start: 0, end: value.length } : null, hallucinated: false });
  return normalizeElement({
    detectedName: over.name, normalizedName: over.name, role: over.role,
    span: { start: 0, end: 4 },
    multiplicity: over.multiplicity ?? 1,
    multiplicityStated: over.multiplicityStated ?? false,
    attributes: {
      material: v(null), quality: v('GR B7'), measure: v('7/8"'),
      length: v(null), standard: v('ASTM A193'), finish: v(null),
    },
  } as never);
}

const qtyOf = (name: string, els: NormalizedElement[]) => {
  const lines = validateRow(analysis(els.length), els, row);
  const l = lines.find((x) => x.attributes.name.normalized === name)!;
  return { quantity: l.quantity, provenance: l.quantityProvenance, policies: l.policiesApplied };
};

describe('procedencia de la cantidad · P-2 sólo asume donde hay algo que asumir', () => {
  const principal = element({ name: 'ESPARRAGO', role: 'principal' });

  test('el principal de un set lee la columna: 40 uds son 40 espárragos', () => {
    const r = qtyOf('ESPARRAGO', [principal, element({ name: 'TUERCA', role: 'secondary' })]);
    assert.equal(r.quantity, 40);
    assert.equal(r.provenance, 'extracted');
    assert.ok(!r.policies.includes('P-2'), 'no se invoca una política que no decide nada');
  });

  test('un secundario sin multiplicidad escrita SÍ es un supuesto: P-2 e inferido', () => {
    const r = qtyOf('TUERCA', [principal, element({ name: 'TUERCA', role: 'secondary' })]);
    assert.equal(r.quantity, 40);
    assert.equal(r.provenance, 'inferred');
    assert.ok(r.policies.includes('P-2'));
  });

  test('un secundario con la multiplicidad escrita no es un supuesto: 2 tuercas por set', () => {
    const els = [principal, element({ name: 'TUERCA', role: 'secondary', multiplicity: 2, multiplicityStated: true })];
    const r = qtyOf('TUERCA', els);
    assert.equal(r.quantity, 80);
    assert.equal(r.provenance, 'extracted');
  });

  test('una fila de un solo elemento nunca fue un supuesto', () => {
    const r = qtyOf('ESPARRAGO', [principal]);
    assert.equal(r.quantity, 40);
    assert.equal(r.provenance, 'extracted');
  });
});

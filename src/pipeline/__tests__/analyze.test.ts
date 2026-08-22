/**
 * The verification of the model's response: what gets kept, what gets demoted, what gets skipped.
 *
 * Every case here comes from a failure that actually happened, and all of them were invisible to
 * the eval harness at the time: two crashed the row, and the rest came out RESUELTA with a purchase
 * quantity that was wrong by a factor of the order size.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysisFromResponse, findMultiplicity } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

/** Builds a row the way ingest does: cells joined by ' | ', with the offset of each one. */
function makeRow(cells: Record<string, string>): MtoRow {
  const parts = Object.values(cells);
  const sourceText = parts.join(' | ');
  const cellOffsets: Record<string, { start: number; end: number }> = {};
  let cursor = 0;
  for (const [header, text] of Object.entries(cells)) {
    cellOffsets[header] = { start: cursor, end: cursor + text.length };
    cursor += text.length + 3;
  }
  return {
    itemRef: cells.ITEM ?? '1', sourceText, cellOffsets,
    quantity: Number(cells.CANTIDAD) || null, quantityColumn: 'CANTIDAD',
    unit: 'uds', sheet: 'MTO', rowNumber: 2,
  };
}

const row = makeRow({
  ITEM: '4',
  DESCRIPCION: 'STUD BOLT 7/8" X 130 LG W/2 HEX. NUT 7/8"',
  MATERIAL: '8.8',
  MEDIDA: '7/8" X 130',
  CANTIDAD: '100',
  UD: 'uds',
});

const noAttrs = {
  material: { value: null, evidence: null }, quality: { value: null, evidence: null },
  measure: { value: null, evidence: null }, length: { value: null, evidence: null },
  standard: { value: null, evidence: null }, finish: { value: null, evidence: null },
};

const element = (over: Record<string, unknown> = {}) => ({
  detectedName: 'HEX. NUT', normalizedName: 'TUERCA', role: 'secondary' as const,
  evidence: 'HEX. NUT 7/8"', multiplicity: 2, multiplicityStated: true,
  multiplicityEvidence: 'W/2 HEX. NUT', attributes: noAttrs, ...over,
});

const analyse = (elements: unknown[]) =>
  analysisFromResponse({ outOfFamily: false, outOfFamilyReason: null, elements } as never, row);

// --- the multiplicity is decided by the row, never by the model ---------------------------------

test('multiplicidad · la que la fila escribe delante del nombre, se aplica', () => {
  const a = analyse([element({ evidence: 'HEX. NUT 7/8"', multiplicity: 2 })]);
  assert.equal(a.elements[0].multiplicity, 2);
  assert.equal(a.elements[0].multiplicityStated, true);
  assert.equal(a.rejectedMultiplicity.length, 0);
});

test('multiplicidad · el modelo no puede subirla si la fila no la escribe', () => {
  // El fallo real de gpt-5.4-mini en la fila 4: multiplicidad 100 tomada de la columna de cantidad.
  // 100 conjuntos pasaban a 10.000 piezas y la línea salía RESUELTA.
  const a = analyse([element({ evidence: 'STUD BOLT', multiplicity: 100 })]);
  assert.equal(a.elements[0].multiplicity, 1, 'la fila no escribe ningún número delante');
  assert.equal(a.elements[0].multiplicityStated, false, 'pasa a política P-2, no a aritmética');
  assert.deepEqual(a.rejectedMultiplicity.map((r) => r.reason), ['not_in_description']);
});

test('multiplicidad · la fila manda también cuando el modelo dice otra cosa', () => {
  const a = analyse([element({ evidence: 'HEX. NUT 7/8"', multiplicity: 7 })]);
  assert.equal(a.elements[0].multiplicity, 2, 'gana el 2 de "W/2"');
  assert.deepEqual(a.rejectedMultiplicity.map((r) => r.reason), ['row_says_other']);
});

test('multiplicidad · no depende de que el modelo rellene ningún campo', () => {
  // El fixture congelado del crítico se grabó antes de que existiera `multiplicityEvidence`. Una
  // guarda que dependa de ese campo convierte 80 tuercas en 40 al releerlo — que es exactamente lo
  // que pasó, y por lo que la fila decide y no el modelo.
  const a = analyse([{ ...element({ evidence: 'HEX. NUT 7/8"', multiplicity: 2 }), multiplicityEvidence: undefined }]);
  assert.equal(a.elements[0].multiplicity, 2);
  assert.equal(a.rejectedMultiplicity.length, 0);
});

test('findMultiplicity · las formas que escriben los MTO, y las que se le parecen', () => {
  const cases: [string, string, number | null, string][] = [
    ['STUD BOLT 7/8" W/2 HEX. NUT 7/8"', 'NUT', 2, 'W/2 con cualificador HEX. de por medio'],
    ['ASTM A194, GR 2H, 2 WASHER 7/8"', 'WASHER', 2, 'introducida por coma'],
    ['STUD BOLT 1", GR B7, W/ 2 NUT ASTM A194', 'NUT', 2, 'W/ con espacio'],
    ['esparrago M20 con 2 tuercas DIN 934', 'tuercas', 2, 'conector español'],
    ['2 tuercas DIN 934 y 2 arandelas DIN 125', 'arandelas', 2, 'conector "y"'],
    ['1" X 200 LG W/ 2 NUT AND 4 WASHER ASTM F436', 'WASHER', 4, 'conector "AND"'],
    ['BOLT DIN931 M16x80 with NUT', 'NUT', null, 'no hay cantidad escrita: P-2'],
    ['HEX BOLT M16 x 70 c/w NUT AND WASHER', 'NUT', null, 'conector sin número'],
    ['BOLT with NUT DIN 934 and WASHER DIN 125', 'WASHER', null, '934 es una NORMA, no una cantidad'],
    ['STUD BOLT 7/8" X 130, 2 WASHER 7/8"', 'WASHER', 2, 'la fracción de la medida no estorba'],
    ['Tornillo M12 tuercas', 'tuercas', null, 'M12 es una medida'],
    ['Arandela 7/8" WASHER', 'WASHER', null, 'una fracción no es una cantidad'],
  ];
  for (const [text, name, expected, why] of cases) {
    const found = findMultiplicity(text, text.indexOf(name));
    assert.equal(found?.value ?? null, expected, `${why}: ${JSON.stringify(text)} -> ${name}`);
  }
});

test('findMultiplicity · nunca cruza la frontera de una celda', () => {
  // `1 | STUD BOLT` haría del número de ITEM una multiplicidad, y la columna de cantidad haría de
  // ella el tamaño del pedido: el bug original, alcanzado por el otro lado.
  const text = '1 | STUD BOLT 7/8" X 130 | 8.8 | 40 | uds';
  assert.equal(findMultiplicity(text, text.indexOf('STUD BOLT')), null);
  assert.equal(findMultiplicity(text, text.indexOf('uds')), null);
});

test('multiplicidad · la cuenta puede venir DENTRO de la evidencia del elemento', () => {
  // El fallo que no vio ningún test unitario: el modelo devuelve `W/2 HEX. NUT 7/8"` como evidencia,
  // así que el `2` cae DENTRO del span del elemento. Anclado al inicio de la evidencia no se ve
  // nada, y se rechazaban las CINCO multiplicidades reales del MTO. El ancla es la posición del
  // NOMBRE, que la da la misma tabla que decide el nombre.
  const text = '1 | STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H';
  const row: MtoRow = {
    itemRef: '1', sourceText: text, cellOffsets: {},
    quantity: 40, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: 2,
  };
  const a = analysisFromResponse({
    outOfFamily: false, outOfFamilyReason: null,
    elements: [{
      detectedName: 'HEX. NUT', normalizedName: 'TUERCA', role: 'secondary',
      evidence: 'W/2 HEX. NUT 7/8"', multiplicity: 2, multiplicityStated: true,
      multiplicityEvidence: null, attributes: noAttrs,
    }],
  } as never, row);
  assert.equal(a.elements[0].multiplicity, 2, '40 conjuntos son 80 tuercas, no 40');
  assert.equal(a.rejectedMultiplicity.length, 0);
});

// --- el veto de la tabla sobre "esto no es tornillería" -----------------------------------------

test('fuera de familia · la tabla veta al modelo cuando reconoce un nombre del catálogo', () => {
  // Caso real de la variante v09: el modelo devolvió "no es tornillería" sobre una fila que empieza
  // por "Tornillo hexagonal DIN 933". Una fila así se iría a la cola de "esto no es mío" y saldría
  // del circuito de compra: no es una compra equivocada, es un material que nadie pide.
  const row: MtoRow = {
    itemRef: '10', sourceText: '10 | Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado | 8.8 | M10x40 | 500 | uds',
    cellOffsets: {}, quantity: 500, quantityColumn: 'CANT.', unit: 'uds', sheet: 'MTO', rowNumber: 11,
  };
  const a = analysisFromResponse({
    outOfFamily: true, outOfFamilyReason: 'Fila no describe tornillería', elements: [],
  } as never, row);

  assert.equal(a.outOfFamily, false, 'la tabla reconoce TORNILLO: la fila se queda en el circuito');
  assert.equal(a.outOfFamilyReason, null);
  assert.equal(a.hallucinations.length, 1, 'la contradicción se cuenta, no se aplica en silencio');
});

test('fuera de familia · una brida SÍ sale fuera: la tabla no reconoce ningún nombre', () => {
  const row: MtoRow = {
    itemRef: '56', sourceText: '56 | BRIDA SLIP-ON 6" 150# ASTM A105 | ASTM A105 | 6" | 12 | uds',
    cellOffsets: {}, quantity: 12, quantityColumn: 'CANT.', unit: 'uds', sheet: 'MTO', rowNumber: 57,
  };
  const a = analysisFromResponse({
    outOfFamily: true, outOfFamilyReason: 'Es una brida', elements: [],
  } as never, row);

  assert.equal(a.outOfFamily, true, 'el veto sólo actúa si la tabla contradice al modelo');
  assert.equal(a.hallucinations.length, 0);
});

test('respuesta mal formada · sin `elements` no rompe la fila', () => {
  // Un modelo abierto no siempre honra el esquema estricto. Antes esto tumbaba la fila con
  // "raw.elements is not iterable" y se perdía la extracción entera.
  const a = analysisFromResponse({ outOfFamily: false, outOfFamilyReason: null } as never, row);
  assert.deepEqual(a.elements, []);
  assert.equal(a.error, null);
});

test('respuesta mal formada · un elemento sin evidencia se salta y se cuenta', () => {
  // Antes: `evidence.trim()` dentro de locate() -> "Cannot read properties of undefined".
  const a = analyse([element({ evidence: undefined }), element()]);
  assert.equal(a.elements.length, 1, 'el elemento legible sobrevive');
  assert.equal(a.hallucinations.length, 1, 'el ilegible se cuenta, no desaparece');
});

test('respuesta mal formada · un valor que no es texto se trata como ausente', () => {
  const a = analyse([element({ attributes: { ...noAttrs, quality: { value: 8.8, evidence: '8.8' } } })]);
  assert.equal(a.elements[0].attributes.quality.value, null);
});

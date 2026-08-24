/**
 * The deterministic baseline extractor — SPEC-003's ablation (src/pipeline/baseline.ts).
 *
 * These tests pin the two things the ablation number depends on: that the baseline is a REAL reader
 * (it splits by name and places attributes), and that it is HONEST (it does not read a measure's
 * digits as a quality, and it does not invent a value it cannot place). If either drifts, the delta
 * over the LLM stops meaning what the 2-pager says it means.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRowBaseline } from '../baseline.ts';
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

test('baseline · no llama al modelo: tier none, sin coste', () => {
  const row = makeRow({ ITEM: '4', DESCRIPCION: 'Tornillo DIN 933 M10 x 40, 8.8', CANTIDAD: '100' });
  const a = analyzeRowBaseline(row);
  assert.equal(a.tier, 'none');
  assert.equal(a.skippedLlm, false);
  assert.equal(a.error, null);
});

test('baseline · parte el set por los nombres del catálogo (la §3, sin modelo)', () => {
  const row = makeRow({
    ITEM: '1',
    DESCRIPCION: 'STUD BOLT 7/8" X 130 LG, ASTM A193 GR B7 W/2 HEX. NUT 7/8", ASTM A194 GR 2H, 2 WASHER 7/8"',
    CANTIDAD: '40',
  });
  const a = analyzeRowBaseline(row);
  assert.deepEqual(
    a.elements.map((e) => e.normalizedName),
    ['ESPARRAGO', 'TUERCA', 'ARANDELA'],
    'tres nombres reconocidos -> tres elementos, en orden',
  );
  assert.equal(a.elements[0].role, 'principal');
  assert.equal(a.elements[1].role, 'secondary');
});

test('baseline · la multiplicidad la decide la fila, igual que el camino con LLM', () => {
  const row = makeRow({
    ITEM: '1',
    DESCRIPCION: 'STUD BOLT 7/8" X 130 LG W/2 HEX. NUT 7/8", 2 WASHER 7/8"',
    CANTIDAD: '40',
  });
  const a = analyzeRowBaseline(row);
  const nut = a.elements.find((e) => e.normalizedName === 'TUERCA');
  assert.equal(nut?.multiplicity, 2, '"W/2" delante de NUT');
  assert.equal(nut?.multiplicityStated, true);
});

test('baseline · atribuye por proximidad: cada norma cae en el elemento que la precede', () => {
  // El caso fácil: cuando cada elemento lleva su norma pegada detrás, la proximidad acierta. Es el
  // otro extremo —dos grados en una sola celda MATERIAL tras todos los nombres— donde la proximidad
  // no puede saber cuál es de quién, y ese es el error silencioso que mide la ablación.
  const row = makeRow({
    ITEM: '3',
    DESCRIPCION: 'Tornillo DIN 931 M12 con Tuerca DIN 934',
    CANTIDAD: '10',
  });
  const a = analyzeRowBaseline(row);
  const bolt = a.elements.find((e) => e.normalizedName === 'TORNILLO');
  const nut = a.elements.find((e) => e.normalizedName === 'TUERCA');
  assert.equal(bolt?.attributes.standard.value, 'DIN 931');
  assert.equal(nut?.attributes.standard.value, 'DIN 934');
});

test('baseline · honesto: no lee el "8" de 7/8" como calidad G8', () => {
  // Sin la guarda de regiones reclamadas, la fracción de la medida se leería como una calidad. Eso
  // sería ruido de tokenización, no el fallo de atribución que la ablación quiere enseñar.
  const row = makeRow({ ITEM: '2', DESCRIPCION: 'WASHER 7/8"', CANTIDAD: '80' });
  const a = analyzeRowBaseline(row);
  assert.equal(a.elements[0].attributes.quality.value, null, 'la medida no se relee como calidad');
});

test('baseline · sin nombre del catálogo no inventa: cero elementos', () => {
  // Una fila en prosa que las tablas no reconocen no se resuelve a la fuerza: sale sin elementos, y
  // el validador la manda a revisión (NO_ELEMENTS_EXTRACTED). Es justo donde el LLM compra cobertura.
  const row = makeRow({ ITEM: '99', DESCRIPCION: 'Elemento de fijación especial, ver plano 12-A', CANTIDAD: '5' });
  const a = analyzeRowBaseline(row);
  assert.deepEqual(a.elements, []);
  assert.equal(a.outOfFamily, false, 'no es "otra familia": es que la tabla no leyó nada');
});

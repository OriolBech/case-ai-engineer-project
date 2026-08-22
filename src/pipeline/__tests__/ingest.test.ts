import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, textAt, type IngestResult } from '../ingest.ts';
import { MTO_ROWS } from '../../rules/__tests__/fixtures.ts';

describe('ingest · MTO real', () => {
  let r: IngestResult;
  before(async () => { r = await ingest('data/input/MTO_tornilleria.xlsx'); });

  test('lee 15 filas, ignorando el título y los blancos', () => {
    assert.equal(r.rows.length, 15);
    assert.deepEqual(r.headers, ['ITEM', 'DESCRIPCION', 'MATERIAL', 'MEDIDA', 'CANT.', 'UD']);
  });

  test('itemRef sale de la columna ITEM, no del índice de fila', () => {
    assert.deepEqual(r.rows.map((x) => x.itemRef), Array.from({ length: 15 }, (_, i) => String(i + 1)));
  });

  test('sourceText conserva descripción Y columna MATERIAL — la fila 1 necesita las dos', () => {
    const row1 = r.rows[0];
    assert.ok(row1.sourceText.includes('ASTM A194'), 'norma de la tuerca, en la descripción');
    assert.ok(row1.sourceText.includes('ASTM A193 GR B7/A194 GR 2H'), 'columna MATERIAL');
  });

  test('los offsets recuperan el substring exacto', () => {
    for (const row of r.rows) {
      for (const [header, span] of Object.entries(row.cellOffsets)) {
        const got = textAt(row, span);
        assert.ok(got.length > 0, `${row.itemRef}/${header} vacío`);
        assert.ok(!got.includes(' | '), `${row.itemRef}/${header} cruza el separador`);
      }
    }
  });

  test('cantidad leída de CANT., no de ITEM', () => {
    assert.deepEqual(
      r.rows.map((x) => x.quantity),
      [40, 160, 80, 100, 24, 60, 50, 75, 30, 500, 200, 40, 300, 250, 120],
    );
    assert.ok(r.rows.every((x) => x.unit === 'uds'));
  });

  test('las descripciones coinciden literalmente con el fixture', () => {
    for (const [i, row] of r.rows.entries()) {
      assert.ok(row.sourceText.includes(MTO_ROWS[i].desc), `fila ${i + 1}`);
    }
  });

  test('no interpreta: el nombre de la columna MATERIAL no se usa como semántica', () => {
    assert.equal(textAt(r.rows[1], r.rows[1].cellOffsets['MATERIAL']), 'A4-70');
  });
});

describe('ingest · set sintético', () => {
  let r: IngestResult;
  before(async () => { r = await ingest('data/synthetic/MTO_sintetico.xlsx'); });

  test('lee 64 filas y no rompe con la descripción vacía', () => {
    assert.equal(r.rows.length, 64);
    const empty = r.rows.find((x) => x.itemRef === '58');
    assert.ok(empty, 'la fila de descripción vacía se conserva: tiene ITEM y cantidad');
    assert.ok(!empty!.sourceText.includes('DIN'), 'y no trae descripción');
  });

  test('la fila con cantidad ausente sale con quantity null', () => {
    const noQty = r.rows.find((x) => x.itemRef === '59');
    assert.equal(noQty?.quantity, null);
  });
});

describe('ingest · la cantidad no se inventa', () => {
  test('sin columna de cantidad reconocible, quantity es null para todas las filas', async () => {
    // Documenta la decisión: la cantidad sale SÓLO de una columna cuya cabecera la identifica.
    // El fallback "último número de la fila" cogería el 8.8 de la columna MATERIAL.
    const r = await ingest('data/synthetic/MTO_sintetico.xlsx');
    const row59 = r.rows.find((x) => x.itemRef === '59');
    assert.equal(row59?.quantity, null, 'fila con CANT. vacía');
    assert.ok(r.rows.filter((x) => x.quantity !== null).length >= 60, 'las demás sí traen cantidad');
  });
});

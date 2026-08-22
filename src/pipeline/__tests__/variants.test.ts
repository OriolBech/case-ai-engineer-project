import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingest } from '../ingest.ts';
import { MTO_ROWS } from '../../rules/__tests__/fixtures.ts';

/**
 * Regresión sobre formatos de fichero. El gold set es un único Excel con un único layout, y el
 * enunciado dice que cada estudio de ingeniería escribe distinto. Estas variantes tienen las MISMAS
 * 15 filas lógicas y distinta forma de fichero.
 */
const DIR = 'data/variants';
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as
  { file: string; ataca: string; expectQuantity: boolean }[];
const QTY = [40, 160, 80, 100, 24, 60, 50, 75, 30, 500, 200, 40, 300, 250, 120];

describe('ingesta · variantes de formato', () => {
  for (const m of manifest) {
    test(`${m.file} — ${m.ataca}`, async () => {
      const r = await ingest(`${DIR}/${m.file}`);
      assert.equal(r.rows.length, 15, 'nº de filas');
      for (const [i, row] of r.rows.entries()) {
        assert.ok(
          row.sourceText.includes(MTO_ROWS[i].desc.split(',')[0]),
          `fila ${i + 1}: descripción perdida`,
        );
        assert.ok(
          row.sourceText.includes(MTO_ROWS[i].materialCol),
          `fila ${i + 1}: columna MATERIAL perdida — de ahí salen calidad y norma`,
        );
        for (const span of Object.values(row.cellOffsets)) {
          const t = row.sourceText.slice(span.start, span.end);
          assert.ok(t.length > 0 && !t.includes(' | '), `fila ${i + 1}: span inválido`);
        }
      }
      if (m.expectQuantity) assert.deepEqual(r.rows.map((x) => x.quantity), QTY, 'cantidades');
      else assert.ok(r.rows.every((x) => x.quantity === null), 'sin cantidad reconocible');
    });
  }

  test('una columna de cantidad no reconocida se avisa a nivel de FICHERO, no 15 veces', async () => {
    const r = await ingest(`${DIR}/v04-sin-cantidad.xlsx`);
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].code, 'QUANTITY_COLUMN_NOT_RECOGNISED');
  });

  test("Q'TY se reconoce: el plegado de cabeceras quita la puntuación", async () => {
    const r = await ingest(`${DIR}/v03-qty-apostrofo.xlsx`);
    assert.deepEqual(r.rows.map((x) => x.quantity), QTY);
    assert.equal(r.warnings.length, 0);
  });

  test('la portada sin cabeceras se ignora y se reporta', async () => {
    const r = await ingest(`${DIR}/v08-segunda-hoja.xlsx`);
    assert.equal(r.rows.length, 15);
    assert.match(r.sheetsIgnored.join(' '), /PORTADA/);
  });
});

/**
 * `pnpm run variants` — pasa la ingesta por cada variante de formato y comprueba invariantes.
 *
 * Sin modelo y sin coste: es la etapa determinista, y es donde vive el riesgo de que un MTO de otro
 * estudio de ingeniería entre mal. Las 15 filas lógicas son las mismas en todas; lo que cambia es la
 * forma del fichero.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { installErrorHandler } from '../src/lib/cli.ts';
import { ingest } from '../src/pipeline/ingest.ts';
import { MTO_ROWS } from '../src/rules/__tests__/fixtures.ts';

installErrorHandler();
const DIR = 'data/variants';
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as
  { file: string; ataca: string; expectQuantity: boolean }[];
const EXPECTED_QTY = [40, 160, 80, 100, 24, 60, 50, 75, 30, 500, 200, 40, 300, 250, 120];

interface Check { name: string; ok: boolean; detail?: string }

for (const m of manifest) {
  const r = await ingest(`${DIR}/${m.file}`);
  const checks: Check[] = [];

  checks.push({ name: '15 filas', ok: r.rows.length === 15, detail: `${r.rows.length}` });

  // La descripción tiene que estar íntegra en sourceText: de ahí salen todos los spans.
  const missingDesc = r.rows
    .map((row, i) => ({ i, ok: MTO_ROWS[i] ? row.sourceText.includes(MTO_ROWS[i].desc.split(',')[0]) : false }))
    .filter((x) => !x.ok).map((x) => x.i + 1);
  checks.push({ name: 'descripción presente', ok: missingDesc.length === 0, detail: missingDesc.length ? `faltan filas ${missingDesc.join(',')}` : '' });

  // La calidad/norma vive en la columna MATERIAL y sin ella se pierden atributos.
  const missingMat = r.rows
    .map((row, i) => ({ i, ok: MTO_ROWS[i] ? row.sourceText.includes(MTO_ROWS[i].materialCol) : false }))
    .filter((x) => !x.ok).map((x) => x.i + 1);
  checks.push({ name: 'columna MATERIAL presente', ok: missingMat.length === 0, detail: missingMat.length ? `faltan ${missingMat.length} filas` : '' });

  const qty = r.rows.map((x) => x.quantity);
  const qtyOk = JSON.stringify(qty) === JSON.stringify(EXPECTED_QTY);
  checks.push({
    name: 'cantidades',
    ok: m.expectQuantity ? qtyOk : true,
    detail: qtyOk ? '' : m.expectQuantity ? `MAL: ${qty.slice(0, 4).join(',')}…` : '(no se esperaba: null)',
  });

  // Los offsets tienen que devolver el substring exacto: es la base de la traza.
  const spansOk = r.rows.every((row) =>
    Object.values(row.cellOffsets).every((s) => {
      const t = row.sourceText.slice(s.start, s.end);
      return t.length > 0 && !t.includes(' | ');
    }));
  checks.push({ name: 'spans exactos', ok: spansOk });

  const bad = checks.filter((c) => !c.ok);
  const mark = bad.length === 0 ? '✔' : '✖';
  console.log(`${mark} ${m.file.padEnd(30)} ${m.ataca}`);
  for (const c of checks) {
    if (!c.ok) console.log(`    ✖ ${c.name}${c.detail ? `: ${c.detail}` : ''}`);
    else if (c.detail) console.log(`    · ${c.name}: ${c.detail}`);
  }
  for (const w of r.warnings) console.log(`    ⚠ ${w.code}: ${w.message}`);
  if (r.sheetsIgnored.length) console.log(`    · hojas ignoradas: ${r.sheetsIgnored.join('; ')}`);
  if (r.skipped.length) console.log(`    · filas descartadas: ${r.skipped.length}`);
}

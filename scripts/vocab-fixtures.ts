/**
 * `pnpm run vocab:fixtures` — prueba el vocabulario de acabado contra filas MTO realistas.
 *
 * Lee `data/vocabulary/fixtures/acabados-mto.csv` y comprueba `resolveFinish` sobre el acabado que
 * el extractor habría aislado. Imprime los comandos `finish:vocab add` listos para copiar.
 *
 *   pnpm run vocab:fixtures -- --write-xlsx   genera el Excel de playground
 *   pnpm run vocab:fixtures -- --strict       exit 1 si alguna fila no cuadra
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { installErrorHandler } from '../src/lib/cli.ts';
import { resolveFinish, type FinishResolution } from '../src/rules/finish-db.ts';

installErrorHandler();

const FIXTURES = join('data', 'vocabulary', 'fixtures', 'acabados-mto.csv');
const XLSX_OUT = join('data', 'vocabulary', 'fixtures', 'MTO_acabados_playground.xlsx');

type Accion = 'ya_cubierto' | 'alta_alias' | 'not_a_finish' | 'escalar' | 'trampa_zincado';

interface FixtureRow {
  id: string;
  categoria: string;
  descripcion: string;
  colMaterial: string;
  colMedida: string;
  cant: string;
  acabadoExtraido: string;
  accionEsperada: Accion;
  finishDestino: string;
  idSugerido: string;
  evidencia: string;
  rationale: string;
  notas: string;
}

function parseCsv(text: string): FixtureRow[] {
  const lines = text.trim().split('\n');
  const [head, ...body] = lines;
  const cols = head.split(',');
  const idx = (name: string) => cols.indexOf(name);
  return body.filter((l) => l.trim()).map((line) => {
    // RFC4180 mínimo: comas dentro de campos entre comillas
    const fields: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
        } else cur += ch;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
    fields.push(cur);
    const g = (name: string) => fields[idx(name)] ?? '';
    return {
      id: g('id'),
      categoria: g('categoria'),
      descripcion: g('descripcion'),
      colMaterial: g('col_material'),
      colMedida: g('col_medida'),
      cant: g('cant'),
      acabadoExtraido: g('acabado_extraido'),
      accionEsperada: g('accion_esperada') as Accion,
      finishDestino: g('finish_destino'),
      idSugerido: g('id_sugerido'),
      evidencia: g('evidencia'),
      rationale: g('rationale'),
      notas: g('notas'),
    };
  });
}

function matches(row: FixtureRow, r: FinishResolution): boolean {
  switch (row.accionEsperada) {
    case 'ya_cubierto':
      return r.kind === 'known' && r.finish === row.finishDestino;
    case 'alta_alias':
      return r.kind === 'unknown';
    case 'not_a_finish':
      return r.kind === 'unknown'; // antes del alta; tras alta sería not_a_finish
    case 'escalar':
      return r.kind === 'unknown' || r.kind === 'ambiguous';
    case 'trampa_zincado':
      return r.kind === 'known' && r.finish === row.finishDestino;
    default:
      return false;
  }
}

function resolutionLabel(r: FinishResolution): string {
  if (r.kind === 'known') return `${r.finish} (${r.entryId})`;
  if (r.kind === 'not_a_finish') return `no-acabado (${r.entryId})`;
  if (r.kind === 'ambiguous') return `ambiguo: ${r.candidates.map((c) => c.alias).join(' vs ')}`;
  return 'desconocido';
}

async function writePlaygroundXlsx(rows: FixtureRow[]): Promise<void> {
  mkdirSync(dirname(XLSX_OUT), { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('MTO');
  ws.addRow(['MTO PLAYGROUND - VOCABULARIO DE ACABADO']);
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow(['ITEM', 'DESCRIPCION', 'MATERIAL', 'MEDIDA', 'CANT.', 'UD']);
  rows.forEach((r, i) => {
    ws.addRow([i + 1, r.descripcion, r.colMaterial, r.colMedida, Number(r.cant), 'uds']);
  });
  await wb.xlsx.writeFile(XLSX_OUT);
  console.log(`\nExcel generado: ${XLSX_OUT}`);
  console.log('  Probar huecos con:  pnpm run gaps -- data/vocabulary/fixtures/MTO_acabados_playground.xlsx');
}

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const wantXlsx = argv.includes('--write-xlsx');

const rows = parseCsv(readFileSync(FIXTURES, 'utf8'));
let fails = 0;
let altas = 0;

console.log(`\nFIXTURES DE ACABADO · ${rows.length} filas · ${FIXTURES}\n`);

for (const row of rows) {
  const r = resolveFinish(row.acabadoExtraido);
  const ok = matches(row, r);
  if (!ok) fails++;

  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${row.id}  ${row.acabadoExtraido}`);
  console.log(`    esperado: ${row.accionEsperada}${row.finishDestino ? ` → ${row.finishDestino}` : ''}`);
  console.log(`    obtenido: ${resolutionLabel(r)}`);
  if (row.notas) console.log(`    nota: ${row.notas}`);

  if (row.accionEsperada === 'alta_alias' && r.kind === 'unknown') {
    altas++;
    console.log('    alta sugerida:');
    console.log(
      `      pnpm run finish:vocab -- add --id=${row.idSugerido} --alias='${row.acabadoExtraido}' ` +
      `--finish=${row.finishDestino} \\\n` +
      `        --why='${row.rationale}' --by='TU NOMBRE' --evidence='${row.evidencia}'`,
    );
  } else if (row.accionEsperada === 'not_a_finish' && r.kind === 'unknown') {
    console.log('    alta sugerida (no es acabado):');
    console.log(
      `      pnpm run finish:vocab -- add --id=${row.idSugerido} --alias='${row.acabadoExtraido}' ` +
      `--kind=not_a_finish --finish=null \\\n` +
      `        --why='${row.rationale}' --by='TU NOMBRE' --evidence='${row.evidencia}'`,
    );
  } else if (row.accionEsperada === 'escalar') {
    console.log('    → escalar al cliente (no autoservicio en vocabulario)');
  } else if (row.accionEsperada === 'trampa_zincado') {
    console.log('    trampa: el alias corto gana. Alta del compuesto primero:');
    console.log(
      `      pnpm run finish:vocab -- add --id=finish-zincado-amarelo --alias='zincado amarelo' --finish=BICROMATADO \\\n` +
      `        --why='Cincado amarelo = bicromatado; más largo que zincado' --by='TU NOMBRE' --evidence='Pliego PT-BR §2.1'`,
    );
  }
  console.log('');
}

console.log(`Resumen: ${rows.length - fails}/${rows.length} cuadran · ${altas} alias pendientes de alta\n`);

if (wantXlsx) await writePlaygroundXlsx(rows);
if (strict && fails) process.exit(1);

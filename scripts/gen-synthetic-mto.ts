/**
 * `pnpm run mto:synthetic` — MTO de patio de pruebas para IMPUTAR vocabulario, no solo acabados.
 *
 * El MTO real mezcla todo en DESCRIPCION. Este fichero parte cada atributo en su columna, para que
 * al subirlo se pueda ejercitar el alta de **varios** vocabularios (acabado, material/calidad,
 * nombre, norma) sin adivinar en qué celda está el token.
 *
 * El ingest concatena TODAS las celdas de texto (`src/pipeline/ingest.ts`), así que una columna
 * extra (ACABADO, NOMBRE, NORMA) entra en `sourceText` igual que DESCRIPCION. MATERIAL sigue siendo
 * la trampa del MTO real: casi nunca es el material, es la calidad.
 *
 *   pnpm run mto:synthetic            escribe data/synthetic/MTO_sugerencias.xlsx
 *   pnpm run mto:synthetic -- --out otra/ruta.xlsx
 *
 * Hoja `MTO`  — la que procesa el pipeline.
 * Hoja `guia` — qué vocabulario imputar en cada fila (el ingest la ignora).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { installErrorHandler } from '../src/lib/cli.ts';

installErrorHandler();

/** Vocabularios que esta fila está pensada para imputar. */
type VocabFocus = 'finish' | 'material' | 'quality' | 'name' | 'norma' | 'mix' | 'control';

interface SyntheticRow {
  descripcion: string;
  /** Columna MATERIAL del MTO: casi siempre es la calidad. */
  calidad: string;
  medida: string;
  cant: number;
  nombre: string;
  norma: string;
  acabado: string;
  vocab: VocabFocus;
  espera: string;
}

const ROWS: SyntheticRow[] = [
  // --- Acabado (P-12). Calidad y nombre cubiertos; el token vive en ACABADO, no en DESCRIPCION.
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M16x60', cant: 120,
    nombre: '', norma: 'DIN 933', acabado: 'tropicalizado',
    vocab: 'finish',
    espera: 'acabado "tropicalizado" → /vocabulario?attr=finish&alias=tropicalizado (P-12, En revisión)',
  },
  {
    descripcion: 'Tornillo Allen',
    calidad: '12.9', medida: 'M10x40', cant: 80,
    nombre: '', norma: 'DIN 912', acabado: 'Delta-Protekt KL 100',
    vocab: 'finish',
    espera: 'acabado "Delta-Protekt KL 100" → alias de GEOMET o escalar',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '10.9', medida: 'M20x90', cant: 60,
    nombre: '', norma: 'DIN 931', acabado: 'Magni 565',
    vocab: 'finish',
    espera: 'acabado "Magni 565" → alias de GEOMET o escalar',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M12x50', cant: 200,
    nombre: '', norma: 'DIN 933', acabado: 'mech galv',
    vocab: 'finish',
    espera: 'acabado "mech galv" → alias de GALVANIZADO EN CALIENTE',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M10x30', cant: 150,
    nombre: '', norma: 'DIN 933', acabado: 'cromato amarelo',
    vocab: 'finish',
    espera: 'acabado "cromato amarelo" → alias de BICROMATADO',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M8x30', cant: 300,
    nombre: '', norma: 'DIN 933', acabado: 'niquelado',
    vocab: 'finish',
    espera: 'acabado "niquelado" → 8º acabado: escalar / no es acabado (no autoservicio)',
  },

  // --- Material (P-3). Calidad en MATERIAL que el vocabulario aún no deriva.
  {
    descripcion: 'Espárrago',
    calidad: 'GR L7', medida: 'M8x20', cant: 200,
    nombre: '', norma: 'ASTM A320', acabado: 'zincado',
    vocab: 'material',
    espera: 'calidad "GR L7" sin derivación → /vocabulario?attr=material&alias=GR%20L7 (elegir AC)',
  },
  {
    descripcion: 'Espárrago',
    calidad: 'GR B8', medida: 'M16x80', cant: 40,
    nombre: '', norma: 'ASTM A193', acabado: 'geomet',
    vocab: 'material',
    espera: 'calidad "GR B8" sin derivación → material INOX',
  },
  {
    descripcion: 'Tuerca',
    calidad: 'GR 12H', medida: 'M12', cant: 90,
    nombre: '', norma: 'ISO 4032', acabado: 'zincado',
    vocab: 'quality',
    espera: 'calidad "GR 12H" fuera de §5 (45H ya está decidida) → hueco de calidad; calidad es solo lectura hoy',
  },

  // --- Nombre. El token va en NOMBRE. "vis" ya está en catálogo; "bullone" no.
  {
    descripcion: '',
    calidad: '8.8', medida: 'M10x40', cant: 50,
    nombre: 'vis', norma: 'ISO 4014', acabado: 'zincado',
    vocab: 'name',
    espera: 'nombre "vis" (FR, ya en §3) → TORNILLO; control de que la columna NOMBRE entra en el ingest',
  },
  {
    descripcion: '',
    calidad: '8.8', medida: 'M12x50', cant: 40,
    nombre: 'bullone', norma: 'UNI 5737', acabado: 'zincado',
    vocab: 'name',
    espera: 'nombre "bullone" (IT, no está en §3) → fuera de familia; nombre es solo lectura hoy',
  },

  // --- Norma. Token en NORMA, no en la descripción.
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M16x70', cant: 70,
    nombre: '', norma: 'WN 70', acabado: 'zincado',
    vocab: 'norma',
    espera: 'norma "WN 70" (Werknorm, fuera de la tabla DIN→ISO) → se conserva; norma es solo lectura hoy',
  },
  {
    descripcion: 'Tuerca',
    calidad: '8', medida: 'M20', cant: 70,
    nombre: '', norma: 'ASME B18.2.2', acabado: 'zincado',
    vocab: 'norma',
    espera: 'norma "ASME B18.2.2" sin equivalencia DIN→ISO → se conserva tal cual',
  },

  // --- Mix: dos vocabularios editables en la misma fila (acabado + material).
  {
    descripcion: 'Espárrago',
    calidad: 'GR L43', medida: 'M24x120', cant: 25,
    nombre: '', norma: 'ASTM A320', acabado: 'tropicalizado',
    vocab: 'mix',
    espera: 'acabado "tropicalizado" (P-12) Y calidad "GR L43" sin material → dos altas, misma fila',
  },

  // --- Control: todo cubierto.
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M16x60', cant: 100,
    nombre: '', norma: 'DIN 933', acabado: 'zincado',
    vocab: 'control',
    espera: 'control: nombre, calidad, norma y acabado ya cubiertos → resuelta',
  },
  {
    descripcion: 'Tuerca',
    calidad: 'A4-70', medida: 'M20', cant: 100,
    nombre: '', norma: 'DIN 934', acabado: 'geomet',
    vocab: 'control',
    espera: 'control: INOX + GEOMET ya conocidos → resuelta',
  },
];

const HEADERS = ['ITEM', 'DESCRIPCION', 'MATERIAL', 'MEDIDA', 'CANT.', 'UD', 'NOMBRE', 'NORMA', 'ACABADO'] as const;

function outPath(): string {
  const i = process.argv.indexOf('--out');
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return join('data', 'synthetic', 'MTO_sugerencias.xlsx');
}

function paintHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
}

async function main(): Promise<void> {
  const out = outPath();
  mkdirSync(dirname(out), { recursive: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'mto-tornilleria';

  const mto = wb.addWorksheet('MTO');
  mto.addRow(['MTO SINTÉTICO — un token por columna, para imputar varios vocabularios']);
  mto.addRow([]);
  mto.addRow([]);
  const header = mto.addRow([...HEADERS]);
  paintHeader(header);
  ROWS.forEach((r, i) => {
    mto.addRow([i + 1, r.descripcion, r.calidad, r.medida, r.cant, 'uds', r.nombre, r.norma, r.acabado]);
  });
  mto.getColumn(1).width = 8;
  mto.getColumn(2).width = 28;
  mto.getColumn(3).width = 12;
  mto.getColumn(4).width = 12;
  mto.getColumn(5).width = 10;
  mto.getColumn(6).width = 8;
  mto.getColumn(7).width = 14;
  mto.getColumn(8).width = 16;
  mto.getColumn(9).width = 24;
  mto.views = [{ state: 'frozen', ySplit: 4 }];

  const guia = wb.addWorksheet('guia');
  const guiaHeader = guia.addRow(['ITEM', 'VOCABULARIO', 'COLUMNA', 'TOKEN', 'EDITABLE HOY', 'QUÉ HACER']);
  paintHeader(guiaHeader);
  const colByVocab: Record<VocabFocus, string> = {
    finish: 'ACABADO',
    material: 'MATERIAL',
    quality: 'MATERIAL',
    name: 'NOMBRE',
    norma: 'NORMA',
    mix: 'ACABADO + MATERIAL',
    control: '—',
  };
  const editable: Record<VocabFocus, string> = {
    finish: 'sí',
    material: 'sí',
    quality: 'no (solo lectura)',
    name: 'no (solo lectura)',
    norma: 'no (solo lectura)',
    mix: 'sí (los dos)',
    control: '—',
  };
  ROWS.forEach((r, i) => {
    const token =
      r.vocab === 'finish' ? r.acabado
      : r.vocab === 'material' || r.vocab === 'quality' ? r.calidad
      : r.vocab === 'name' ? r.nombre
      : r.vocab === 'norma' ? r.norma
      : r.vocab === 'mix' ? `${r.acabado} + ${r.calidad}`
      : '—';
    guia.addRow([i + 1, r.vocab, colByVocab[r.vocab], token, editable[r.vocab], r.espera]);
  });
  guia.getColumn(1).width = 8;
  guia.getColumn(2).width = 14;
  guia.getColumn(3).width = 22;
  guia.getColumn(4).width = 28;
  guia.getColumn(5).width = 20;
  guia.getColumn(6).width = 88;
  guia.views = [{ state: 'frozen', ySplit: 1 }];

  await wb.xlsx.writeFile(out);

  const count = (v: VocabFocus): number => ROWS.filter((r) => r.vocab === v).length;
  console.log(`Escrito ${out} (${ROWS.length} filas, columnas ${HEADERS.join(' | ')}).\n`);
  console.log('Qué ejercita cada bloque:');
  console.log(`  acabado  ${count('finish')}  → columna ACABADO (editable)`);
  console.log(`  material ${count('material')}  → columna MATERIAL / calidad (editable)`);
  console.log(`  calidad  ${count('quality')}  → GR 12H fuera de §5 (solo lectura hoy)`);
  console.log(`  nombre   ${count('name')}  → columna NOMBRE (solo lectura hoy)`);
  console.log(`  norma    ${count('norma')}  → columna NORMA (solo lectura hoy)`);
  console.log(`  mix      ${count('mix')}  → acabado + material en la misma fila`);
  console.log(`  control  ${count('control')}  → ya cubiertos, cola verde\n`);
  console.log('La hoja "guia" lista item → vocabulario → token. El pipeline no la lee.');
  console.log('Comprobar:  pnpm run gaps -- ' + out);
}

await main();

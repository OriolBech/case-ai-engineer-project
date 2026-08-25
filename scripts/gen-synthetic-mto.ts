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

  // --- Acabado, control positivo: alias YA en la tabla. Tienen que resolver por vocabulario,
  // sin sugerencia ni revisión. Si alguno sale en cola, la tabla o el plegado se han roto.
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M12x40', cant: 100,
    nombre: '', norma: 'DIN 933', acabado: 'HDG',
    vocab: 'control',
    espera: 'control: "HDG" ya es alias de GALVANIZADO EN CALIENTE → resuelta por tabla',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M14x50', cant: 90,
    nombre: '', norma: 'DIN 933', acabado: 'GALVA',
    vocab: 'control',
    espera: 'control: "GALVA" ya es alias de GALVANIZADO EN CALIENTE → resuelta por tabla',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M10x35', cant: 140,
    nombre: '', norma: 'DIN 933', acabado: 'YZP',
    vocab: 'control',
    espera: 'control: "YZP" ya es alias de BICROMATADO → resuelta por tabla',
  },
  {
    descripcion: 'Vis',
    calidad: '8.8', medida: 'M10x45', cant: 60,
    nombre: '', norma: 'ISO 4017', acabado: 'zingue',
    vocab: 'control',
    espera: 'control: "zingue" (FR) ya es alias de CINCADO, acento plegado → resuelta por tabla',
  },
  {
    descripcion: 'Tornillo Allen',
    calidad: '12.9', medida: 'M8x25', cant: 200,
    nombre: '', norma: 'DIN 912', acabado: 'black',
    vocab: 'control',
    espera: 'control: "black" ya es alias de PAVONADO → resuelta por tabla',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M16x50', cant: 110,
    nombre: '', norma: 'DIN 931', acabado: 'phosphate',
    vocab: 'control',
    espera: 'control: "phosphate" ya es alias de FOSFATADO → resuelta por tabla',
  },
  {
    descripcion: 'Tuerca',
    calidad: '8', medida: 'M10', cant: 400,
    nombre: '', norma: 'DIN 934', acabado: 'zincadas',
    vocab: 'control',
    espera: 'control: "zincadas" (concordancia) ya es alias de CINCADO → resuelta por tabla',
  },

  // --- Acabado desconocido, segunda hornada: candidatos de alta distintos de los primeros.
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M12x60', cant: 75,
    nombre: '', norma: 'DIN 933', acabado: 'Ruspert 1000',
    vocab: 'finish',
    espera: 'acabado "Ruspert 1000" → candidato a alias de GEOMET (o escalar si el cliente lo separa)',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M16x80', cant: 45,
    nombre: '', norma: 'DIN 931', acabado: 'Geomet 500',
    vocab: 'finish',
    espera: 'acabado "Geomet 500" → candidato a alias de GEOMET',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '10.9', medida: 'M20x70', cant: 55,
    nombre: '', norma: 'DIN 931', acabado: 'Dacromet 320',
    vocab: 'finish',
    espera: 'acabado "Dacromet 320" → candidato a alias de DACROMET',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M24x100', cant: 30,
    nombre: '', norma: 'DIN 933', acabado: 'sherardizado',
    vocab: 'finish',
    espera: 'acabado "sherardizado" → no es ninguno de los 7 de §9: escalar, NO autoservicio',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M10x50', cant: 130,
    nombre: '', norma: 'DIN 933', acabado: 'zinc-niquel',
    vocab: 'finish',
    espera: 'acabado "zinc-niquel" → aleación, fuera de §9: escalar, NO autoservicio',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M12x30', cant: 220,
    nombre: '', norma: 'DIN 933', acabado: 'galv',
    vocab: 'finish',
    espera: 'acabado "galv" a secas → ambiguo entre CINCADO y GALVANIZADO EN CALIENTE: el alta la decide el cliente, no nosotros',
  },

  // --- Guarda entre atributos: el token es una CALIDAD, no un acabado.
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M8x20', cant: 500,
    nombre: '', norma: 'DIN 933', acabado: 'A2',
    vocab: 'finish',
    espera: 'acabado "A2" → es una calidad de §5, no un acabado: la guarda entre atributos aún no existe (07-target-solution, línea 5); hoy se dejaría dar de alta',
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
    espera: 'calidad "GR 12H" fuera de §5 (45H ya está decidida) → hueco de calidad con candidata; alta ágil en /vocabulario?attr=quality eligiendo grupo (SPEC-017)',
  },

  // --- Material, control positivo: la tabla de derivación YA cubre estas calidades (P-3).
  // Si alguna pide alta, la tabla se ha roto. A2-80 además vigila el invariante de no
  // convertir entre grupos: es G2 aislado, NO equivale a A2.
  {
    descripcion: 'Espárrago',
    calidad: 'GR B16', medida: 'M20x100', cant: 35,
    nombre: '', norma: 'ASTM A193', acabado: 'zincado',
    vocab: 'control',
    espera: 'control: "GR B16" tiene entrada en la tabla → material AC sin tocar nada',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: 'A4-80', medida: 'M16x60', cant: 70,
    nombre: '', norma: 'DIN 933', acabado: '',
    vocab: 'control',
    espera: 'control: "A4-80" es G4 → INOX por tabla; y G4 no se convierte a G3 (A4)',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: 'GRADE 5', medida: 'M12x45', cant: 180,
    nombre: '', norma: 'DIN 931', acabado: 'zincado',
    vocab: 'control',
    espera: 'control: "GRADE 5" es G5 → AC por tabla',
  },
  {
    descripcion: 'Tornillo Allen',
    calidad: 'A2-80', medida: 'M6x20', cant: 300,
    nombre: '', norma: 'DIN 912', acabado: '',
    vocab: 'control',
    espera: 'control: "A2-80" es G2 AISLADO → INOX por tabla, y NO equivale a A2',
  },

  // --- Material, hueco deliberado de la tabla: la calidad existe pero nadie ha decidido su
  // derivación. Sale hueco de política con entrada candidata, NO material vacío ni inventado.
  {
    descripcion: 'Espárrago',
    calidad: 'GR B8M', medida: 'M12x70', cant: 50,
    nombre: '', norma: 'ASTM A193', acabado: '',
    vocab: 'material',
    espera: 'calidad "GR B8M" (A193 inox con molibdeno) sin entrada → hueco P-3 con candidata INOX',
  },
  {
    descripcion: 'Espárrago',
    calidad: 'GR 660', medida: 'M16x90', cant: 20,
    nombre: '', norma: 'ASTM A453', acabado: '',
    vocab: 'material',
    espera: 'calidad "GR 660" (A453, superaleación) sin entrada → hueco P-3; no se deriva por parecido con B7',
  },

  // --- Material, deliberadamente SIN derivación: una dureza HV describe el tratamiento de la
  // arandela, no el metal base. Ni deriva ni sugiere: si aparece sugerencia de material aquí,
  // alguien ha roto deliberatelyUncovered.
  {
    descripcion: 'Arandela',
    calidad: '200HV', medida: 'M16', cant: 600,
    nombre: '', norma: 'DIN 125', acabado: 'zincada',
    vocab: 'material',
    espera: 'calidad "200HV" (G13) → material NO se deriva (deliberatelyUncovered): ni INOX/AC ni sugerencia',
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
  {
    descripcion: '',
    calidad: '8.8', medida: 'M8x30', cant: 250,
    nombre: 'Schraube', norma: 'DIN 933', acabado: 'verzinkt',
    vocab: 'name',
    espera: 'nombre "Schraube" (DE) y acabado "verzinkt" (DE) → los dos fuera de tabla; doble candidato de alta en dos vocabularios',
  },
  {
    descripcion: '',
    calidad: 'A2', medida: 'M6x16', cant: 350,
    nombre: 'parafuso', norma: 'DIN 933', acabado: 'zincado',
    vocab: 'name',
    espera: 'nombre "parafuso" (PT, no está en §3) → fuera de familia; nombre es solo lectura hoy',
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
  {
    descripcion: 'Tornillo hexagonal',
    calidad: '8.8', medida: 'M16x55', cant: 95,
    nombre: '', norma: 'UNI 5739', acabado: 'zincado',
    vocab: 'norma',
    espera: 'norma "UNI 5739" (IT) fuera de la tabla DIN→ISO → se conserva; norma es solo lectura hoy',
  },
  {
    descripcion: 'Tornillo hexagonal',
    calidad: 'GR R', medida: 'M20x65', cant: 40,
    nombre: '', norma: 'BS 3692', acabado: 'galvanizado en caliente',
    vocab: 'norma',
    espera: 'norma "BS 3692" (UK) se conserva; calidad "GR R" además no tiene derivación de material → hueco P-3 en la misma fila',
  },

  // --- Mix segunda hornada: un vocabulario YA cubierto y otro NO en la misma fila. El acabado
  // resuelve por tabla y el material pide alta: una fila no es monolítica.
  {
    descripcion: 'Espárrago',
    calidad: 'GR B8M', medida: 'M20x110', cant: 30,
    nombre: '', norma: 'ASTM A193', acabado: 'HDG',
    vocab: 'mix',
    espera: 'acabado "HDG" resuelve por tabla Y calidad "GR B8M" pide alta de material → verde y revisión a la vez',
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

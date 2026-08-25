/**
 * Trap bank — invariants the client's rules decide, independent of the 15-row gold.
 *
 * Not a second gold set. A gold line is seven attributes plus quantity, labelled by us. A trap is
 * a single claim a rule already makes ("8 on a bolt is incoherent", "HDG is hot-dip galvanized").
 * Measuring those does not contaminate the KPI: they were true before the pipeline existed.
 *
 * `must` traps fail `pnpm test`. `hole` traps are scored and printed; they document what tables
 * alone still get wrong (the ablation) without turning a known gap into a red CI.
 */

import type { ItemName, LineStatus, ReasonCode } from '../pipeline/types.ts';

export type TrapGate = 'must' | 'hole';

export interface TrapCells {
  DESCRIPCION: string;
  MATERIAL?: string;
  MEDIDA?: string;
  CANTIDAD?: string;
}

export interface TrapExpect {
  /** Expected number of output lines. */
  split?: number;
  name?: ItemName;
  quality?: string;
  /** Group id from `attributes.quality.rule` (`quality:G1`). */
  qualityGroup?: string;
  finish?: string | null;
  standard?: string;
  status?: LineStatus;
  reasonsInclude?: ReasonCode[];
  /** No line may leave RESUELTA. The expensive error on a flange or an incoherent grade. */
  noneResolved?: boolean;
  /** No RESUELTA line may carry this quality value. */
  noResolvedQuality?: string;
}

export interface Trap {
  id: string;
  /** Coverage-matrix block from docs/09-coverage-and-blind-set.md, when it maps. */
  family: string;
  rule: string;
  why: string;
  gate: TrapGate;
  cells: TrapCells;
  expect: TrapExpect;
}

export const TRAPS: readonly Trap[] = [
  {
    id: 'C1',
    family: 'C · coherencia',
    rule: '§5 · 8 solo aplica a tuercas',
    why: 'Ninguna fila del MTO lo ejercita. Apuesta 4 del blind set.',
    gate: 'must',
    cells: { DESCRIPCION: 'BOLT DIN 931 M16x60, 8', MATERIAL: '8', MEDIDA: 'M16x60', CANTIDAD: '100' },
    expect: { split: 1, name: 'TORNILLO', status: 'REVISION_MANUAL', reasonsInclude: ['QUALITY_TYPE_INCOHERENCE'] },
  },
  {
    id: 'C2',
    family: 'C · coherencia',
    rule: '§5 · 10 solo aplica a tuercas',
    why: 'Espejo de C1. El MTO real nunca trae un 10.',
    gate: 'must',
    cells: { DESCRIPCION: 'Tornillo DIN 933 M12x40, 10, zincado', MATERIAL: '10', MEDIDA: 'M12x40', CANTIDAD: '150' },
    expect: { split: 1, name: 'TORNILLO', status: 'REVISION_MANUAL', reasonsInclude: ['QUALITY_TYPE_INCOHERENCE'] },
  },
  {
    id: 'C-nut-88',
    family: 'C · coherencia',
    rule: 'P-6 · 8.8 en tuerca es incoherente, no se convierte a 8',
    why: 'La fila 13 del MTO. Nunca reescribir 8.8 → 8.',
    gate: 'must',
    cells: { DESCRIPCION: 'Tuerca autoblocante DIN 985 M12, 8.8, zincada', MATERIAL: '8.8', MEDIDA: 'M12', CANTIDAD: '300' },
    expect: { name: 'TUERCA', status: 'REVISION_MANUAL', reasonsInclude: ['QUALITY_TYPE_INCOHERENCE'] },
  },
  {
    id: 'B11',
    family: 'B · calidad',
    rule: '§5 G8 · 8 en tuerca es válido',
    why: 'La prueba directa que el MTO no trae: 8 en tuerca no es incoherencia.',
    gate: 'must',
    cells: { DESCRIPCION: 'NUT DIN 934 M20, 8', MATERIAL: '8', MEDIDA: 'M20', CANTIDAD: '250' },
    expect: { name: 'TUERCA', quality: '8', qualityGroup: 'G8' },
  },
  {
    id: 'B1',
    family: 'B · calidad',
    rule: '§5 G1 · 304 ≡ A2',
    why: 'La tabla de equivalencias no se ejercita en el MTO dado: todos los valores ya son canónicos.',
    gate: 'must',
    cells: { DESCRIPCION: 'HEX BOLT DIN 933 M10x30, 304', MATERIAL: '304', MEDIDA: 'M10x30', CANTIDAD: '120' },
    expect: { name: 'TORNILLO', quality: '304', qualityGroup: 'G1' },
  },
  {
    id: 'B9',
    family: 'B · calidad',
    rule: '§5 G6 · GRADE 8 ≡ 10.9, no es G5',
    why: 'GRADE 8 no es GRADE 5. Confundirlos compra el tornillo equivocado.',
    gate: 'must',
    cells: { DESCRIPCION: 'BOLT DIN 933 M16x50, GRADE 8', MATERIAL: 'GRADE 8', MEDIDA: 'M16x50', CANTIDAD: '70' },
    expect: { quality: 'GRADE 8', qualityGroup: 'G6' },
  },
  {
    id: 'D1',
    family: 'D · acabado',
    rule: '§9 · HDG → GALVANIZADO EN CALIENTE',
    why: 'El acabado más común en obra y el MTO no lo trae.',
    gate: 'must',
    cells: { DESCRIPCION: 'BOLT DIN 933 M16x60, 8.8, HDG', MATERIAL: '8.8', MEDIDA: 'M16x60', CANTIDAD: '80' },
    expect: { finish: 'GALVANIZADO EN CALIENTE' },
  },
  {
    id: 'D11',
    family: 'D · acabado',
    rule: '§9 · ZP → CINCADO',
    why: 'Alias de dos letras. Falso negativo típico si el matcher no es por palabra.',
    gate: 'must',
    cells: { DESCRIPCION: 'Tornillo DIN 931 M12x60, 8.8, ZP', MATERIAL: '8.8', MEDIDA: 'M12x60', CANTIDAD: '160' },
    expect: { finish: 'CINCADO' },
  },
  {
    id: 'A1',
    family: 'A · nombre',
    rule: '§3 · THREADED ROD es VARILLA ROSCADA',
    why: 'Único nombre del catálogo que el MTO de 15 filas no usa.',
    gate: 'must',
    cells: { DESCRIPCION: 'THREADED ROD M12 X 1000, DIN 975, A4-70', MATERIAL: 'A4-70', MEDIDA: 'M12x1000', CANTIDAD: '20' },
    expect: { split: 1, name: 'VARILLA ROSCADA' },
  },
  {
    id: 'N-stud',
    family: 'A · nombre',
    rule: '§3 · STUD BOLT es ESPARRAGO, no TORNILLO',
    why: 'Longest-alias-first. El modelo barato falló exactamente aquí.',
    gate: 'must',
    cells: { DESCRIPCION: 'STUD BOLT 3/4" X 110 LG, ASTM A193 GR B7', MATERIAL: 'ASTM A193 GR B7', MEDIDA: '3/4"x110', CANTIDAD: '40' },
    expect: { split: 1, name: 'ESPARRAGO' },
  },
  {
    id: 'J1',
    family: 'J · idioma',
    rule: '§3 · VIS → TORNILLO',
    why: 'Tercer idioma. En el catálogo; el MTO dado es solo ES/EN.',
    gate: 'must',
    cells: { DESCRIPCION: 'Vis a tete hexagonale DIN 933 M10 x 40, 8.8, zingue', MATERIAL: '8.8', MEDIDA: 'M10x40', CANTIDAD: '200' },
    expect: { name: 'TORNILLO', finish: 'CINCADO' },
  },
  {
    id: 'J-de',
    family: 'J · idioma',
    rule: '§3 · SCHRAUBE → TORNILLO',
    why: 'Alemán en el catálogo de nombres. El MTO no lo ejercita.',
    gate: 'must',
    cells: { DESCRIPCION: 'Schraube DIN 933 M12 x 50, 8.8, zincado', MATERIAL: '8.8', MEDIDA: 'M12x50', CANTIDAD: '80' },
    expect: { name: 'TORNILLO' },
  },
  {
    id: 'F5',
    family: 'F · norma',
    rule: '§8 · DIN 6923 → EN 1661',
    why: 'Única equivalencia de la tabla que va a EN, no a ISO.',
    gate: 'must',
    cells: { DESCRIPCION: 'Tuerca DIN 6923 M10, 8', MATERIAL: '8', MEDIDA: 'M10', CANTIDAD: '280' },
    expect: { name: 'TUERCA', standard: 'EN 1661' },
  },
  {
    id: 'G-din933',
    family: 'G · norma',
    rule: '§8 · DIN 933 → ISO 4017',
    why: 'Equivalencia del MTO, anclada fuera de las 15 filas para que una regresión de tabla no dependa del gold.',
    gate: 'must',
    cells: { DESCRIPCION: 'Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado', MATERIAL: '8.8', MEDIDA: 'M10x40', CANTIDAD: '500' },
    expect: { standard: 'ISO 4017', finish: 'CINCADO' },
  },
  {
    id: 'H1',
    family: 'H · unidades',
    rule: '§6 · pulgadas y métrica no son equivalentes',
    why: 'M20 x 3" mezcla sistemas. El baseline lee el 3 como 3 mm y resuelve. El LLM (o un parser de designation con pulgadas) tiene que comprar este delta. El MTO dado nunca mezcla.',
    gate: 'hole',
    cells: { DESCRIPCION: 'BOLT DIN 933 M20 x 3", 8.8, zincado', MATERIAL: '8.8', MEDIDA: 'M20x3"', CANTIDAD: '50' },
    expect: { noneResolved: true },
  },
  {
    id: 'H5',
    family: 'H · obligatorios',
    rule: '§7 · longitud obligatoria en tornillo',
    why: 'Ninguna fila del MTO carece de longitud en un principal.',
    gate: 'must',
    cells: { DESCRIPCION: 'Tornillo DIN 933 M12, 8.8', MATERIAL: '8.8', MEDIDA: 'M12', CANTIDAD: '100' },
    expect: { status: 'REVISION_MANUAL', reasonsInclude: ['LENGTH_MISSING'] },
  },
  {
    id: 'I1',
    family: 'I · P-9',
    rule: 'P-9 · una brida no se resuelve como tornillería',
    why: 'El fallo silencioso que el enunciado describe: siete atributos inventados sobre una fila que no es nuestra.',
    gate: 'must',
    cells: { DESCRIPCION: 'BRIDA SLIP-ON 6" 150# ASTM A105', MATERIAL: 'ASTM A105', MEDIDA: '6"', CANTIDAD: '12' },
    expect: { noneResolved: true },
  },
  {
    id: 'K-set',
    family: 'K · set',
    rule: '§2 · un set se parte en una línea por elemento',
    why: 'El corte por catálogo. Si esto falla, el LLM no es el único lector que parte mal.',
    gate: 'must',
    cells: {
      DESCRIPCION: 'BOLT DIN931 M20x90 with NUT DIN934 M20',
      MATERIAL: 'A4-70',
      MEDIDA: 'M20x90',
      CANTIDAD: '160',
    },
    expect: { split: 2 },
  },
  {
    id: 'H-attr',
    family: 'ablación · atribución',
    rule: 'La columna MATERIAL no es del último nombre',
    why: 'El error silencioso de `pnpm run eval -- --ablate=extract`: la arandela salía RESUELTA con GR B7. El LLM lo evita; las tablas solas no.',
    gate: 'hole',
    cells: {
      DESCRIPCION: 'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436',
      MATERIAL: 'ASTM A193 GR B7/A194 GR 2H',
      MEDIDA: '7/8" X 130',
      CANTIDAD: '40',
    },
    expect: { split: 3, noResolvedQuality: 'GR B7' },
  },
  {
    id: 'H-de-finish',
    family: 'ablación · acabado no catalogado',
    rule: 'P-12 · un recubrimiento no mapeado no se resuelve en blanco',
    why: 'Feuerverzinkt no está en §9. El baseline no lo extrae como acabado, así que P-12 no dispara y la línea puede salir desnuda. El hueco que D9 de Arnau cierra y el nuestro, en tablas solas, no.',
    gate: 'hole',
    cells: {
      DESCRIPCION: 'Schraube DIN 933 M12 x 50, 8.8, feuerverzinkt',
      MATERIAL: '8.8',
      MEDIDA: 'M12x50',
      CANTIDAD: '100',
    },
    expect: { noneResolved: true },
  },
];

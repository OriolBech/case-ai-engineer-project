/** Buyer-facing derivations from the pipeline's raw output. No business logic lives here — only
 *  presentation: how a Provenance reads, which queue a line belongs to, how to group and export. */
import { ATTRIBUTE_KEYS, type OutputLine, type Provenance, type ReasonKind } from '../../src/pipeline/types.ts';

export type Queue = 'resuelta' | 'ingenieria' | 'comprador' | 'fuera-familia';

/**
 * §SPEC-008: separate queues by reason kind, because each one is a different person's next move.
 *
 * OUT_OF_SCOPE goes first and on its own (P-9). A flange is not a fastener whose data is missing,
 * so it is not engineering's to fix — the row is already right. It belongs to whoever buys the
 * other families, and putting it in the engineering queue would be sending back work that nobody
 * asked for, in the queue the case statement says must stay clean. Then MISSING_IN_SOURCE goes
 * back to engineering — no buyer action fixes a value that was never written. Everything else
 * unresolved is the buyer's.
 */
export function queueOf(line: OutputLine): Queue {
  if (line.status === 'RESUELTA') return 'resuelta';
  const kinds = new Set<ReasonKind>(line.reasons.map((r) => r.kind));
  if (kinds.has('OUT_OF_SCOPE')) return 'fuera-familia';
  return kinds.has('MISSING_IN_SOURCE') ? 'ingenieria' : 'comprador';
}

/**
 * The denominator every rate in the buyer's panel is over.
 *
 * Out-of-family lines are not in it. They are neither a win nor a failure of a fastener system:
 * counting them as unresolved would penalise the system for a row it correctly refused to touch,
 * and counting them as resolved would be a lie. They are reported apart, by count.
 */
export function inScope(lines: OutputLine[]): OutputLine[] {
  return lines.filter((l) => queueOf(l) !== 'fuera-familia');
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  exact_catalog: 'catálogo',
  extracted: 'extraído',
  table_normalized: 'normalizado',
  extracted_uncatalogued: 'fuera de catálogo',
  extrapolated: 'extrapolado',
  derived: 'derivado',
  inferred: 'inferido',
  absent: 'ausente',
  not_applicable: 'no aplica',
};

/** Provenances the spec calls out as needing a visible mark: anything that is not a literal hit. */
const MARKED: ReadonlySet<Provenance> = new Set([
  'extrapolated', 'derived', 'inferred', 'extracted_uncatalogued',
]);

export function isMarked(p: Provenance): boolean {
  return MARKED.has(p);
}

/** Weak enough that a human should be able to see it at a glance, next to `isMarked`. */
export function isWeak(p: Provenance): boolean {
  return p === 'inferred' || p === 'derived' || p === 'extracted_uncatalogued';
}

export const ATTR_LABEL: Record<(typeof ATTRIBUTE_KEYS)[number], string> = {
  name: 'Nombre',
  material: 'Material',
  quality: 'Calidad',
  measure: 'Medida',
  length: 'Longitud',
  standard: 'Norma',
  finish: 'Acabado',
};

export interface RowGroup {
  key: string;
  rowRef: string;
  sourceText: string | null;
  lines: OutputLine[];
}

/** Groups output lines by the MTO row they exploded from, in first-seen order. */
export function groupByRow(lines: OutputLine[], sourceText: Map<string, string>): RowGroup[] {
  const order: string[] = [];
  const byRef = new Map<string, OutputLine[]>();
  for (const l of lines) {
    if (!byRef.has(l.rowRef)) { byRef.set(l.rowRef, []); order.push(l.rowRef); }
    byRef.get(l.rowRef)!.push(l);
  }
  return order.map((rowRef) => ({
    key: rowRef,
    rowRef,
    sourceText: sourceText.get(rowRef) ?? null,
    lines: byRef.get(rowRef)!,
  }));
}

/** Groups by the buyer's real next step: which family of fastener, i.e. who the RFQ goes to. */
export function groupByFamily(lines: OutputLine[]): RowGroup[] {
  const byFamily = new Map<string, OutputLine[]>();
  for (const l of lines) {
    const key = l.attributes.name.normalized ?? 'SIN CLASIFICAR';
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key)!.push(l);
  }
  return [...byFamily.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, ls]) => ({ key, rowRef: key, sourceText: null, lines: ls }));
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: n < 1 ? 4 : 2 }).format(n);
}

export function formatSeconds(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function linesToCsv(lines: OutputLine[]): string {
  const header = [
    'familia', 'linea_id', 'fila_origen', 'cantidad', 'unidad_cantidad',
    ...ATTRIBUTE_KEYS, 'estado', 'motivos',
  ];
  const rows = lines
    .slice()
    .sort((a, b) => (a.attributes.name.normalized ?? '').localeCompare(b.attributes.name.normalized ?? ''))
    .map((l) => [
      l.attributes.name.normalized ?? '',
      l.id,
      l.rowRef,
      l.quantity ?? '',
      l.quantityProvenance,
      ...ATTRIBUTE_KEYS.map((k) => l.attributes[k].normalized ?? ''),
      l.status,
      l.reasons.map((r) => r.message).join(' / '),
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// KPIs sin verdad de referencia
// ---------------------------------------------------------------------------
//
// Sobre un MTO sin etiquetar no se puede calcular el error silencioso, la autonomía útil ni el split
// fidelity: las tres comparan contra respuestas conocidas. Lo que sí se puede calcular es DÓNDE ESTÁ
// EL RIESGO, y eso es lo que hay aquí.
//
// La idea que lo sostiene: una línea resuelta es tan fuerte como su dato más débil. El umbral del
// proyecto está expresado exactamente así (`THRESHOLD_MIN_PROVENANCE`, ver docs/02-kpi.md §4), así que
// el reparto de las líneas resueltas por su procedencia más débil es el indicador adelantado del
// error silencioso: si aparece, aparece en la cola de abajo.

/** De fuerte a débil. Mismo orden que PROVENANCE_SCORE en src/lib/confidence.ts. */
export const PROVENANCE_ORDER: readonly Provenance[] = [
  'exact_catalog', 'table_normalized', 'extracted', 'extracted_uncatalogued',
  'extrapolated', 'derived', 'inferred', 'absent',
];

const RANK = new Map(PROVENANCE_ORDER.map((p, i) => [p, i]));

/**
 * La procedencia más débil de una línea, ignorando `not_applicable`.
 *
 * `not_applicable` se excluye porque no es una debilidad: la longitud de una tuerca no aplica por §7,
 * y contarla como el eslabón débil pondría todas las tuercas y arandelas al final de la lista.
 */
export function weakestProvenance(line: OutputLine): Provenance {
  let worst: Provenance = 'exact_catalog';
  for (const k of ATTRIBUTE_KEYS) {
    const p = line.attributes[k].provenance;
    if (p === 'not_applicable') continue;
    if ((RANK.get(p) ?? 0) > (RANK.get(worst) ?? 0)) worst = p;
  }
  return worst;
}

export interface ProvenanceBucket {
  provenance: Provenance;
  lines: OutputLine[];
}

/** Líneas RESUELTAS agrupadas por su eslabón más débil, de fuerte a débil. Vacíos incluidos. */
export function resolvedByWeakestProvenance(lines: OutputLine[]): ProvenanceBucket[] {
  const byProv = new Map<Provenance, OutputLine[]>(PROVENANCE_ORDER.map((p) => [p, []]));
  for (const l of lines) {
    if (queueOf(l) !== 'resuelta') continue;
    byProv.get(weakestProvenance(l))!.push(l);
  }
  return PROVENANCE_ORDER.map((provenance) => ({ provenance, lines: byProv.get(provenance)! }));
}

/**
 * Cuántas veces cada atributo es el eslabón más débil de una línea resuelta.
 *
 * Es el desglose que pide el enunciado —*"los agregados esconden dónde falla el sistema"*— en la
 * versión que se puede calcular sin etiquetas: no dice qué atributo falla, dice qué atributo es el que
 * sostiene menos peso.
 */
export function weakestAttributeCounts(lines: OutputLine[]): { attribute: string; count: number; provenance: Provenance }[] {
  const counts = new Map<string, { count: number; provenance: Provenance }>();
  for (const l of lines) {
    if (queueOf(l) !== 'resuelta') continue;
    const worst = weakestProvenance(l);
    if (worst === 'exact_catalog' || worst === 'table_normalized' || worst === 'extracted') continue;
    for (const k of ATTRIBUTE_KEYS) {
      if (l.attributes[k].provenance !== worst) continue;
      const prev = counts.get(k);
      counts.set(k, { count: (prev?.count ?? 0) + 1, provenance: worst });
    }
  }
  return [...counts.entries()]
    .map(([attribute, v]) => ({ attribute, ...v }))
    .sort((a, b) => b.count - a.count);
}

/** Cuántas filas produjeron 1, 2, 3… líneas. No es split fidelity —eso necesita gold— pero se ve. */
export function splitDistribution(lines: OutputLine[]): { elements: number; rows: number }[] {
  const perRow = new Map<string, number>();
  for (const l of lines) perRow.set(l.rowRef, (perRow.get(l.rowRef) ?? 0) + 1);
  const hist = new Map<number, number>();
  for (const n of perRow.values()) hist.set(n, (hist.get(n) ?? 0) + 1);
  return [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([elements, rows]) => ({ elements, rows }));
}

/** Motivos de revisión agrupados: 300 líneas con el mismo motivo son UNA acción, no trescientas. */
export function reasonCounts(lines: OutputLine[]): { code: string; message: string; count: number; queue: Queue }[] {
  const byCode = new Map<string, { message: string; count: number; queue: Queue }>();
  for (const l of lines) {
    const q = queueOf(l);
    if (q === 'resuelta') continue;
    for (const r of l.reasons) {
      const prev = byCode.get(r.code);
      byCode.set(r.code, { message: prev?.message ?? r.message, count: (prev?.count ?? 0) + 1, queue: prev?.queue ?? q });
    }
  }
  return [...byCode.entries()]
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Extrapolación a los volúmenes del enunciado, con el denominador honesto.
 *
 * El coste se cobra por fila LEÍDA, no por fila de tornillería: para saber cuáles de las 20.000 son
 * tornillería hay que leerlas. Ver docs/05-results.md §7.
 */
export function extrapolate(costEur: number, rowsRead: number): { perRow: number; perRevision: number; perProject: number } {
  const perRow = rowsRead ? costEur / rowsRead : 0;
  return { perRow, perRevision: perRow * 20_000, perProject: perRow * 20_000 * 25 };
}

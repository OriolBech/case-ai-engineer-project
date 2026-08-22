/** Buyer-facing derivations from the pipeline's raw output. No business logic lives here — only
 *  presentation: how a Provenance reads, which queue a line belongs to, how to group and export. */
import { ATTRIBUTE_KEYS, type OutputLine, type Provenance, type ReasonKind } from '../../src/pipeline/types.ts';

export type Queue = 'resuelta' | 'ingenieria' | 'comprador';

/**
 * §SPEC-008: two separate queues by reason kind. A line carrying any MISSING_IN_SOURCE reason
 * goes back to engineering — no buyer action fixes a value that was never written. Everything
 * else unresolved is the buyer's queue.
 */
export function queueOf(line: OutputLine): Queue {
  if (line.status === 'RESUELTA') return 'resuelta';
  const kinds = new Set<ReasonKind>(line.reasons.map((r) => r.kind));
  return kinds.has('MISSING_IN_SOURCE') ? 'ingenieria' : 'comprador';
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

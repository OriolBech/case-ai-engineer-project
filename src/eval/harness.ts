/**
 * Evaluation harness. See specs/SPEC-009-eval-harness.md.
 *
 * Compares pipeline output against the hand-labelled gold set in data/gold/gold.jsonl.
 *
 * The one rule that makes the numbers defensible: metrics are computed over cells the gold set
 * marks CERTAIN (deducible from the client's rules). Cells that depend on a declared policy are
 * reported separately as sensitivity. A KPI that mixes the two cannot be defended in front of a
 * client, because half of it is measuring our own opinion.
 */

import { readFileSync } from 'node:fs';
import type { OutputLine } from '../pipeline/types.ts';
import { ATTRIBUTE_KEYS, type Attributes } from '../pipeline/types.ts';

export interface GoldCell { value: string | number | null; provenance: string; certainty: 'C' | 'P' }

export interface GoldLine {
  id: string;
  rowRef: string;
  role: 'principal' | 'secondary';
  status: 'RESUELTA' | 'REVISION_MANUAL';
  reasons: string[];
  attributes: Record<keyof Attributes, GoldCell>;
  quantity: GoldCell;
  note?: string;
}

export function loadGold(path = 'data/gold/gold.jsonl'): GoldLine[] {
  return readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as GoldLine);
}

/** Comparison is on meaning, not formatting: case, accents and inner whitespace are ignored. */
function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .replace(/\s+/g, ' ').trim();
    return s === '' || s === '—' ? null : s;
  };
  return norm(a) === norm(b);
}

/** Las ocho celdas graduables de una línea: los siete atributos y la cantidad. */
export type GradedCell = keyof Attributes | 'quantity';

export interface CellResult {
  lineId: string;
  rowRef: string;
  attribute: GradedCell;
  certainty: 'C' | 'P';
  expected: string | null;
  got: string | null;
  ok: boolean;
}

export interface LineResult {
  rowRef: string;
  goldId: string | null;
  systemId: string | null;
  /** null when the row's line count differs and no counterpart exists. */
  aligned: boolean;
  statusOk: boolean;
  goldStatus: string | null;
  systemStatus: string | null;
  /** All seven attributes correct, counting CERTAIN cells only. */
  allCertainOk: boolean;
  cells: CellResult[];
  missingReasons: string[];
  extraReasons: string[];
}

export interface EvalReport {
  model: string;
  rows: number;
  goldLines: number;
  systemLines: number;

  /** Rows whose line count matches the gold set. Reported apart: a wrong count is not a wrong
   *  attribute, it is a material nobody buys. */
  splitFidelity: { ok: number; total: number; pct: number; failures: string[] };

  /** THE primary metric: resolved lines carrying at least one wrong CERTAIN cell. */
  silentErrorRate: { bad: number; resolved: number; pct: number; lines: string[] };

  /** Resolved AND fully correct, over all gold lines. The metric that buys hours. */
  usefulAutonomy: { ok: number; total: number; pct: number };

  /** Lines the system sent to review that the gold set resolves. The invisible failure. */
  queueNoise: { noisy: number; review: number; pct: number; lines: string[] };

  statusAgreement: { ok: number; total: number; pct: number };

  perAttribute: Record<string, { okC: number; totalC: number; pctC: number; okP: number; totalP: number }>;

  reasonAgreement: { exact: number; total: number; pct: number };

  lines: LineResult[];
}

/**
 * Aligns gold and system lines row by row.
 *
 * Equal counts align by position, since both list the principal first. Unequal counts are a split
 * failure for that row: the surplus or missing lines are reported instead of being force-matched,
 * because a forced match invents an agreement that is not there.
 */
function alignRow(gold: GoldLine[], sys: OutputLine[]): [GoldLine | null, OutputLine | null][] {
  if (gold.length === sys.length) return gold.map((g, i) => [g, sys[i]]);
  const pairs: [GoldLine | null, OutputLine | null][] = [];
  const used = new Set<number>();
  for (const g of gold) {
    const i = sys.findIndex((s, j) => !used.has(j) && same(s.attributes.name.normalized, g.attributes.name.value));
    if (i >= 0) { used.add(i); pairs.push([g, sys[i]]); } else pairs.push([g, null]);
  }
  sys.forEach((s, j) => { if (!used.has(j)) pairs.push([null, s]); });
  return pairs;
}

export function evaluate(systemLines: OutputLine[], gold: GoldLine[], model: string): EvalReport {
  const byRowGold = group(gold, (g) => g.rowRef);
  const byRowSys = group(systemLines, (l) => l.rowRef);
  const rowRefs = [...new Set([...byRowGold.keys(), ...byRowSys.keys()])].sort(numeric);

  const lines: LineResult[] = [];
  const splitFailures: string[] = [];

  for (const rowRef of rowRefs) {
    const g = byRowGold.get(rowRef) ?? [];
    const s = byRowSys.get(rowRef) ?? [];
    if (g.length !== s.length) splitFailures.push(`${rowRef} (gold ${g.length} / sistema ${s.length})`);

    for (const [gl, sl] of alignRow(g, s)) {
      const cells: CellResult[] = [];
      if (gl && sl) {
        for (const k of ATTRIBUTE_KEYS) {
          const expected = gl.attributes[k].value;
          const got = sl.attributes[k].normalized;
          cells.push({
            lineId: sl.id, rowRef, attribute: k,
            certainty: gl.attributes[k].certainty,
            expected: expected === null ? null : String(expected),
            got, ok: same(expected, got),
          });
        }
        // La cantidad es la OCTAVA celda, y estuvo etiquetada en el gold desde el primer día sin
        // que nadie la comparara: el bucle sólo recorría los siete atributos. Se descubrió porque
        // el crítico señaló dos líneas de `gpt-5.4-mini` con 10.000 y 2.500 uds donde el MTO pide
        // 100 y 50 — el modelo se había llevado la columna de cantidad al campo de multiplicidad —
        // y el harness las daba por PERFECTAS.
        //
        // No es un atributo del catálogo, y por eso no entra en `perAttribute` con los otros siete.
        // Pero es el único campo donde equivocarse multiplica el pedido, así que cuenta para el
        // error silencioso igual que los demás. El reparto C/P del gold ya hace el trabajo de
        // política: cantidad escrita es CIERTA, multiplicidad no escrita (P-2) es de política.
        cells.push({
          lineId: sl.id, rowRef, attribute: 'quantity',
          certainty: gl.quantity.certainty,
          expected: gl.quantity.value === null ? null : String(gl.quantity.value),
          got: sl.quantity === null ? null : String(sl.quantity),
          ok: same(gl.quantity.value, sl.quantity),
        });
      }
      const goldReasons = new Set<string>(gl?.reasons ?? []);
      const sysReasons = new Set<string>((sl?.reasons ?? []).map((r) => String(r.code)));
      lines.push({
        rowRef,
        goldId: gl?.id ?? null,
        systemId: sl?.id ?? null,
        aligned: !!gl && !!sl,
        statusOk: !!gl && !!sl && gl.status === sl.status,
        goldStatus: gl?.status ?? null,
        systemStatus: sl?.status ?? null,
        allCertainOk: cells.filter((c) => c.certainty === 'C').every((c) => c.ok) && !!gl && !!sl,
        cells,
        missingReasons: [...goldReasons].filter((r) => !sysReasons.has(r)),
        extraReasons: [...sysReasons].filter((r) => !goldReasons.has(r)),
      });
    }
  }

  const aligned = lines.filter((l) => l.aligned);
  const resolvedSys = aligned.filter((l) => l.systemStatus === 'RESUELTA');
  const badResolved = resolvedSys.filter((l) => !l.allCertainOk);
  const reviewSys = aligned.filter((l) => l.systemStatus === 'REVISION_MANUAL');
  const noisy = reviewSys.filter((l) => l.goldStatus === 'RESUELTA');

  const perAttribute: EvalReport['perAttribute'] = {};
  for (const k of [...ATTRIBUTE_KEYS, 'quantity'] as const) {
    const cs = aligned.flatMap((l) => l.cells.filter((c) => c.attribute === k));
    const c = cs.filter((x) => x.certainty === 'C');
    const p = cs.filter((x) => x.certainty === 'P');
    perAttribute[k] = {
      okC: c.filter((x) => x.ok).length, totalC: c.length,
      pctC: c.length ? (100 * c.filter((x) => x.ok).length) / c.length : 100,
      okP: p.filter((x) => x.ok).length, totalP: p.length,
    };
  }

  const reasonExact = lines.filter((l) => l.aligned && !l.missingReasons.length && !l.extraReasons.length).length;

  return {
    model,
    rows: rowRefs.length,
    goldLines: gold.length,
    systemLines: systemLines.length,
    splitFidelity: {
      ok: rowRefs.length - splitFailures.length, total: rowRefs.length,
      pct: (100 * (rowRefs.length - splitFailures.length)) / rowRefs.length,
      failures: splitFailures,
    },
    silentErrorRate: {
      bad: badResolved.length, resolved: resolvedSys.length,
      pct: resolvedSys.length ? (100 * badResolved.length) / resolvedSys.length : 0,
      lines: badResolved.map((l) => l.systemId ?? '?'),
    },
    usefulAutonomy: {
      ok: resolvedSys.filter((l) => l.allCertainOk).length, total: gold.length,
      pct: (100 * resolvedSys.filter((l) => l.allCertainOk).length) / gold.length,
    },
    queueNoise: {
      noisy: noisy.length, review: reviewSys.length,
      pct: reviewSys.length ? (100 * noisy.length) / reviewSys.length : 0,
      lines: noisy.map((l) => l.systemId ?? '?'),
    },
    statusAgreement: {
      ok: aligned.filter((l) => l.statusOk).length, total: aligned.length,
      pct: aligned.length ? (100 * aligned.filter((l) => l.statusOk).length) / aligned.length : 0,
    },
    perAttribute,
    reasonAgreement: {
      exact: reasonExact, total: aligned.length,
      pct: aligned.length ? (100 * reasonExact) / aligned.length : 0,
    },
    lines,
  };
}

function group<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = key(x); (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
  return m;
}

const numeric = (a: string, b: string): number => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b);

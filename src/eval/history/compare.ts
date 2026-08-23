/**
 * Comparación entre dos ejecuciones guardadas. Ver SPEC-010 §Comparación mínima y punto 6-9.
 *
 * La comparabilidad depende de la POBLACIÓN de prueba (dataset + políticas), no del sistema bajo
 * prueba: comparar dos modelos distintos sobre el mismo dataset y las mismas políticas es
 * exactamente el caso de uso. Comparar el mismo modelo sobre gold o políticas distintas no lo es, y
 * se marca `comparable: false` sin dejar de mostrar los números (SPEC-010 punto 7).
 */
import { getRun, getRunLines, getRunMetrics, type MetricRow, type StoredRun } from './store.ts';
import type { LineResult } from '../harness.ts';

export interface MetricComparison {
  name: string;
  base: number;
  candidate: number;
  delta: number;
  direction: 'improved' | 'regressed' | 'unchanged';
  baseNumerator: number | null;
  baseDenominator: number | null;
  candidateNumerator: number | null;
  candidateDenominator: number | null;
}

export interface ChangedLine {
  rowRef: string;
  goldId: string | null;
  change: 'fixed' | 'regressed' | 'status_changed' | 'split_changed';
  details: string[];
}

export interface EvaluationComparison {
  baseRunId: string;
  candidateRunId: string;
  comparable: boolean;
  incompatibilities: string[];
  metrics: MetricComparison[];
  changedLines: ChangedLine[];
}

/** SPEC-010 punto 8: menor es mejor para error silencioso, ruido y coste. Todo lo demás, mayor. */
const LOWER_IS_BETTER = new Set(['silent_error_rate', 'queue_noise', 'cost_eur', 'latency_ms']);

function direction(name: string, base: number, candidate: number): MetricComparison['direction'] {
  if (base === candidate) return 'unchanged';
  const better = LOWER_IS_BETTER.has(name) ? candidate < base : candidate > base;
  return better ? 'improved' : 'regressed';
}

function metricKey(m: { scope: string; name: string }): string {
  return m.scope === 'global' ? m.name : `${m.scope}.${m.name}`;
}

function compareMetrics(baseRows: MetricRow[], candRows: MetricRow[]): MetricComparison[] {
  const baseMap = new Map(baseRows.map((m) => [metricKey(m), m]));
  const candMap = new Map(candRows.map((m) => [metricKey(m), m]));
  const names = [...new Set([...baseMap.keys(), ...candMap.keys()])].sort();

  const out: MetricComparison[] = [];
  for (const name of names) {
    const b = baseMap.get(name);
    const c = candMap.get(name);
    // Una métrica que sólo existe en un lado (p. ej. un atributo con celdas de política en un run y
    // ninguna en el otro) no tiene con qué compararse: se omite en vez de inventar un cero.
    if (!b || !c) continue;
    out.push({
      name,
      base: b.value,
      candidate: c.value,
      delta: c.value - b.value,
      direction: direction(name, b.value, c.value),
      baseNumerator: b.numerator,
      baseDenominator: b.denominator,
      candidateNumerator: c.numerator,
      candidateDenominator: c.denominator,
    });
  }
  return out;
}

/** Coste y latencia viven en `evaluation_runs`, no en `evaluation_metrics`: se añaden aparte. */
function compareOperational(base: StoredRun, candidate: StoredRun): MetricComparison[] {
  const out: MetricComparison[] = [
    {
      name: 'latency_ms',
      base: base.latencyMs,
      candidate: candidate.latencyMs,
      delta: candidate.latencyMs - base.latencyMs,
      direction: direction('latency_ms', base.latencyMs, candidate.latencyMs),
      baseNumerator: null,
      baseDenominator: null,
      candidateNumerator: null,
      candidateDenominator: null,
    },
  ];
  // Un coste desconocido en cualquiera de los dos runs se omite: nunca se compara contra 0.
  if (base.costEur !== null && candidate.costEur !== null) {
    out.push({
      name: 'cost_eur',
      base: base.costEur,
      candidate: candidate.costEur,
      delta: candidate.costEur - base.costEur,
      direction: direction('cost_eur', base.costEur, candidate.costEur),
      baseNumerator: null,
      baseDenominator: null,
      candidateNumerator: null,
      candidateDenominator: null,
    });
  }
  return out;
}

function lineKey(l: { rowRef: string; goldId: string | null }): string {
  return `${l.rowRef}::${l.goldId ?? ''}`;
}

/** Misma definición que `usefulAutonomy` en el harness: resuelta, alineada y sin celdas ciertas falladas. */
function isGood(l: LineResult): boolean {
  return l.aligned && l.systemStatus === 'RESUELTA' && l.allCertainOk;
}

function cellDiffs(b: LineResult, c: LineResult): string[] {
  const details: string[] = [];
  if (b.systemStatus !== c.systemStatus) details.push(`estado: ${b.systemStatus} -> ${c.systemStatus}`);
  const byAttr = new Map(c.cells.map((cell) => [cell.attribute, cell]));
  for (const bc of b.cells) {
    const cc = byAttr.get(bc.attribute);
    if (cc && bc.certainty === 'C' && bc.ok !== cc.ok) {
      const was = bc.ok ? 'ok' : `mal (${JSON.stringify(bc.got)})`;
      const now = cc.ok ? 'ok' : `mal (${JSON.stringify(cc.got)})`;
      details.push(`${bc.attribute}: ${was} -> ${now}`);
    }
  }
  return details;
}

/**
 * Líneas responsables del delta. Sólo se comparan líneas del GOLD (tienen `goldId`): una línea de
 * sistema sin contrapartida ya se cuenta en `split_fidelity` y no tiene con qué compararse fila a
 * fila entre dos ejecuciones.
 */
function compareLines(baseLines: LineResult[], candLines: LineResult[]): ChangedLine[] {
  const baseByKey = new Map(baseLines.filter((l) => l.goldId).map((l) => [lineKey(l), l]));
  const candByKey = new Map(candLines.filter((l) => l.goldId).map((l) => [lineKey(l), l]));
  const keys = [...new Set([...baseByKey.keys(), ...candByKey.keys()])].sort();

  const out: ChangedLine[] = [];
  for (const key of keys) {
    const b = baseByKey.get(key);
    const c = candByKey.get(key);
    const rowRef = (b ?? c)!.rowRef;
    const goldId = (b ?? c)!.goldId;

    if (!b || !c) {
      out.push({
        rowRef,
        goldId,
        change: 'split_changed',
        details: [!c ? 'la línea desaparece en la ejecución candidata' : 'la línea es nueva en la ejecución candidata'],
      });
      continue;
    }
    if (b.aligned !== c.aligned) {
      out.push({ rowRef, goldId, change: 'split_changed', details: [`alineada: ${b.aligned} -> ${c.aligned}`] });
      continue;
    }
    const bGood = isGood(b);
    const cGood = isGood(c);
    if (bGood !== cGood) {
      out.push({ rowRef, goldId, change: cGood ? 'fixed' : 'regressed', details: cellDiffs(b, c) });
      continue;
    }
    if (b.systemStatus !== c.systemStatus) {
      out.push({ rowRef, goldId, change: 'status_changed', details: [`${b.systemStatus} -> ${c.systemStatus}`] });
    }
  }
  return out;
}

export function compareRuns(baseId: string, candidateId: string): EvaluationComparison {
  const base = getRun(baseId);
  const candidate = getRun(candidateId);
  if (!base) throw new Error(`No existe la ejecución '${baseId}'.`);
  if (!candidate) throw new Error(`No existe la ejecución '${candidateId}'.`);

  const incompatibilities: string[] = [];
  if (base.datasetFingerprint !== candidate.datasetFingerprint) {
    incompatibilities.push(
      `dataset distinto: '${base.datasetName}' (${base.datasetFingerprint.slice(0, 12)}…) vs ` +
        `'${candidate.datasetName}' (${candidate.datasetFingerprint.slice(0, 12)}…). El gold, el criterio ` +
        'de certeza o la población fuera de familia pueden haber cambiado.',
    );
  }
  if (base.policyFingerprint !== candidate.policyFingerprint) {
    incompatibilities.push('políticas distintas entre ambas ejecuciones: revisa policyOverrides de cada run.');
  }

  const metrics = [...compareMetrics(getRunMetrics(baseId), getRunMetrics(candidateId)), ...compareOperational(base, candidate)];
  const changedLines = compareLines(getRunLines(baseId), getRunLines(candidateId));

  return {
    baseRunId: baseId,
    candidateRunId: candidateId,
    comparable: incompatibilities.length === 0,
    incompatibilities,
    metrics,
    changedLines,
  };
}

import type { CorrectionKpi } from '../eval/history/corrections.ts';
import type { MetricRow, StoredRun } from '../eval/history/store.ts';

export const CORRECTION_TARGET_SECONDS = 90;
export const PROJECT_ROWS_READ = 500_000;
export const MANUAL_PROJECT_HOURS = 2_500;

const ATTRIBUTE_LABELS: Record<string, string> = {
  name: 'Nombre',
  material: 'Material',
  quality: 'Calidad',
  measure: 'Medida',
  length: 'Longitud',
  standard: 'Norma',
  finish: 'Acabado',
  quantity: 'Cantidad',
};

export interface CorrectionTimingKpi {
  targetSeconds: number;
  sampleCount: number;
  p50Seconds: number | null;
  p90Seconds: number | null;
  withinTargetCount: number;
}

export type LifecycleEventType =
  | 'revision_opened'
  | 'review_closed'
  | 'rfq_sent'
  | 'order_placed'
  | 'supplier_confirmed'
  | 'delivered';

export interface DurationDistribution {
  sampleCount: number;
  p50Hours: number | null;
  p90Hours: number | null;
}

export interface LifecycleEvent {
  id: string;
  occurredAt: string;
  projectId: string;
  revisionId: string;
  flowId: string;
  eventType: LifecycleEventType;
  supplier: string | null;
  note: string;
}

export interface ProcurementLifecycleKpi {
  eventCounts: Record<LifecycleEventType, number>;
  reviewTime: DurationDistribution;
  rfqToOrder: DurationDistribution;
  orderToSupplierConfirmation: DurationDistribution;
  orderToDelivery: DurationDistribution;
  rfqToDelivery: DurationDistribution;
  recentEvents: LifecycleEvent[];
}

export interface KpiDashboard {
  evaluation: {
    run: Pick<StoredRun, 'id' | 'createdAt' | 'label' | 'datasetName' | 'model' | 'rows' | 'goldLines'>;
    silentError: { pct: number; count: number; resolved: number } | null;
    usefulAutonomy: { pct: number; count: number; total: number } | null;
    splitFidelity: { pct: number; count: number; total: number } | null;
    queueNoise: { pct: number; count: number; total: number } | null;
    attributes: Array<{ attribute: string; label: string; pct: number; count: number; total: number }>;
    cost: { perRowEur: number; projectedProjectEur: number; projectRows: number } | null;
    latency: {
      serialMinutesPerThousand: number;
      idealMinutesAtConcurrency8: number;
      sampleRuns: number;
    } | null;
    estimatedHoursSaved: number | null;
  } | null;
  corrections: {
    timing: CorrectionTimingKpi;
    funnel: Pick<CorrectionKpi, 'pending' | 'approved' | 'promoted' | 'conflicts'>;
    reuseCount: number;
  };
  lifecycle: ProcurementLifecycleKpi;
}

function metric(metrics: MetricRow[], scope: string, name: string): MetricRow | null {
  return metrics.find((m) => m.scope === scope && m.name === name) ?? null;
}

function ratio(m: MetricRow | null): { pct: number; count: number; total: number } | null {
  if (!m || m.numerator === null || m.denominator === null) return null;
  return { pct: m.value, count: m.numerator, total: m.denominator };
}

export function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentileValue * sorted.length));
  return sorted[rank - 1] ?? null;
}

export function correctionTimingFromDurations(durationsMs: number[]): CorrectionTimingKpi {
  const seconds = durationsMs.filter((v) => Number.isFinite(v) && v >= 0).map((v) => v / 1_000);
  return {
    targetSeconds: CORRECTION_TARGET_SECONDS,
    sampleCount: seconds.length,
    p50Seconds: percentile(seconds, 0.5),
    p90Seconds: percentile(seconds, 0.9),
    withinTargetCount: seconds.filter((v) => v <= CORRECTION_TARGET_SECONDS).length,
  };
}

export function durationDistributionFromDurations(durationsMs: number[]): DurationDistribution {
  const hours = durationsMs.filter((v) => Number.isFinite(v) && v >= 0).map((v) => v / 3_600_000);
  return {
    sampleCount: hours.length,
    p50Hours: percentile(hours, 0.5),
    p90Hours: percentile(hours, 0.9),
  };
}

export function deriveKpiDashboard(input: {
  run: StoredRun | null;
  metrics: MetricRow[];
  corrections: CorrectionKpi;
  timing: CorrectionTimingKpi;
  reuseCount: number;
  lifecycle: ProcurementLifecycleKpi;
}): KpiDashboard {
  const evaluation = input.run
    ? (() => {
        const silent = ratio(metric(input.metrics, 'global', 'silent_error_rate'));
        const useful = ratio(metric(input.metrics, 'global', 'useful_autonomy'));
        const split = ratio(metric(input.metrics, 'global', 'split_fidelity'));
        const noise = ratio(metric(input.metrics, 'global', 'queue_noise'));
        const perRowEur =
          input.run.pricesConfigured && input.run.costEur !== null && input.run.costEur > 0 && input.run.rows > 0
            ? input.run.costEur / input.run.rows
            : null;
        const serialMinutesPerThousand =
          input.run.rows > 0 && input.run.latencyMs > 0
            ? (input.run.latencyMs / input.run.rows) * 1_000 / 60_000
            : null;

        return {
          run: {
            id: input.run.id,
            createdAt: input.run.createdAt,
            label: input.run.label,
            datasetName: input.run.datasetName,
            model: input.run.model,
            rows: input.run.rows,
            goldLines: input.run.goldLines,
          },
          silentError: silent
            ? { pct: silent.pct, count: silent.count, resolved: silent.total }
            : null,
          usefulAutonomy: useful,
          splitFidelity: split,
          queueNoise: noise,
          attributes: input.metrics
            .filter((m) => m.scope === 'attribute' && m.numerator !== null && m.denominator !== null)
            .map((m) => ({
              attribute: m.name,
              label: ATTRIBUTE_LABELS[m.name] ?? m.name,
              pct: m.value,
              count: m.numerator!,
              total: m.denominator!,
            }))
            .sort((a, b) => Object.keys(ATTRIBUTE_LABELS).indexOf(a.attribute) - Object.keys(ATTRIBUTE_LABELS).indexOf(b.attribute)),
          cost:
            perRowEur === null
              ? null
              : {
                  perRowEur,
                  projectedProjectEur: perRowEur * PROJECT_ROWS_READ,
                  projectRows: PROJECT_ROWS_READ,
                },
          latency:
            serialMinutesPerThousand === null
              ? null
              : {
                  serialMinutesPerThousand,
                  idealMinutesAtConcurrency8: serialMinutesPerThousand / 8,
                  sampleRuns: 1,
                },
          estimatedHoursSaved:
            useful === null ? null : MANUAL_PROJECT_HOURS * (useful.pct / 100),
        };
      })()
    : null;

  return {
    evaluation,
    corrections: {
      timing: input.timing,
      funnel: {
        pending: input.corrections.pending,
        approved: input.corrections.approved,
        promoted: input.corrections.promoted,
        conflicts: input.corrections.conflicts,
      },
      reuseCount: input.reuseCount,
    },
    lifecycle: input.lifecycle,
  };
}

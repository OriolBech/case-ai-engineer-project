import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveKpiDashboard, correctionTimingFromDurations } from '../metrics.ts';
import type { CorrectionKpi } from '../../eval/history/corrections.ts';
import type { MetricRow, StoredRun } from '../../eval/history/store.ts';

const RUN: StoredRun = {
  id: 'run-1',
  createdAt: '2026-08-24T20:00:00.000Z',
  label: 'entrega',
  datasetName: 'gold',
  datasetFingerprint: 'dataset',
  gitCommit: 'abc',
  gitDirty: false,
  model: 'model',
  provider: 'provider',
  routing: 'main',
  criticRouting: 'eligible',
  policyFingerprint: 'policy',
  policyOverrides: [],
  configurationFingerprint: 'config',
  rows: 10,
  goldLines: 20,
  systemLines: 20,
  latencyMs: 60_000,
  costEur: 0.001,
  pricesConfigured: true,
};

const CORRECTIONS: CorrectionKpi = {
  pending: 2,
  approved: 3,
  promoted: 4,
  rejected: 1,
  conflicts: 1,
  conflictRate: 1 / 9,
  promotedVerified: 0,
  promotedWrong: 0,
  silentErrorRate: null,
};

const METRICS: MetricRow[] = [
  { scope: 'global', name: 'silent_error_rate', value: 5, numerator: 1, denominator: 20 },
  { scope: 'global', name: 'useful_autonomy', value: 50, numerator: 10, denominator: 20 },
  { scope: 'global', name: 'split_fidelity', value: 100, numerator: 10, denominator: 10 },
  { scope: 'global', name: 'queue_noise', value: 10, numerator: 1, denominator: 10 },
  { scope: 'attribute', name: 'quantity', value: 95, numerator: 19, denominator: 20 },
];

const LIFECYCLE = {
  eventCounts: {
    revision_opened: 0,
    review_closed: 0,
    rfq_sent: 0,
    order_placed: 0,
    supplier_confirmed: 0,
    delivered: 0,
  },
  reviewTime: { sampleCount: 0, p50Hours: null, p90Hours: null },
  rfqToOrder: { sampleCount: 0, p50Hours: null, p90Hours: null },
  orderToSupplierConfirmation: { sampleCount: 0, p50Hours: null, p90Hours: null },
  orderToDelivery: { sampleCount: 0, p50Hours: null, p90Hours: null },
  rfqToDelivery: { sampleCount: 0, p50Hours: null, p90Hours: null },
  recentEvents: [],
};

describe('derivación del panel KPI', () => {
  test('conserva recuentos y calcula coste, latencia y horas con sus denominadores', () => {
    const result = deriveKpiDashboard({
      run: RUN,
      metrics: METRICS,
      corrections: CORRECTIONS,
      timing: correctionTimingFromDurations([30_000, 120_000]),
      reuseCount: 7,
      lifecycle: LIFECYCLE,
    });

    assert.equal(result.evaluation?.silentError?.count, 1);
    assert.equal(result.evaluation?.silentError?.resolved, 20);
    assert.equal(result.evaluation?.attributes[0]?.attribute, 'quantity');
    assert.equal(result.evaluation?.cost?.perRowEur, 0.0001);
    assert.equal(result.evaluation?.cost?.projectedProjectEur, 50);
    assert.equal(result.evaluation?.latency?.serialMinutesPerThousand, 100);
    assert.equal(result.evaluation?.estimatedHoursSaved, 1_250);
    assert.equal(result.corrections.timing.p50Seconds, 30);
    assert.equal(result.corrections.timing.p90Seconds, 120);
    assert.equal(result.corrections.reuseCount, 7);
  });

  test('el histórico vacío queda explícitamente sin evaluación, no como ceros medidos', () => {
    const result = deriveKpiDashboard({
      run: null,
      metrics: [],
      corrections: { ...CORRECTIONS, pending: 0, approved: 0, promoted: 0, conflicts: 0 },
      timing: correctionTimingFromDurations([]),
      reuseCount: 0,
      lifecycle: LIFECYCLE,
    });

    assert.equal(result.evaluation, null);
    assert.equal(result.corrections.timing.sampleCount, 0);
    assert.equal(result.corrections.timing.p50Seconds, null);
    assert.equal(result.corrections.timing.p90Seconds, null);
  });

  test('coste y latencia cero del histórico se tratan como no medidos', () => {
    const result = deriveKpiDashboard({
      run: { ...RUN, costEur: 0, latencyMs: 0 },
      metrics: METRICS,
      corrections: CORRECTIONS,
      timing: correctionTimingFromDurations([]),
      reuseCount: 0,
      lifecycle: LIFECYCLE,
    });

    assert.equal(result.evaluation?.cost, null);
    assert.equal(result.evaluation?.latency, null);
  });
});

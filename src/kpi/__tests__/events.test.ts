import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeKpiEventsDb,
  correctionTimingKpi,
  listVocabularyKpiEntryIds,
  procurementLifecycleKpi,
  recordCorrectionKpiEvent,
  recordLifecycleEvent,
  recordVocabularyKpiEvent,
} from '../events.ts';

beforeEach(() => {
  process.env.KPI_EVENTS_DB = ':memory:';
  closeKpiEventsDb();
});

afterEach(() => {
  closeKpiEventsDb();
  delete process.env.KPI_EVENTS_DB;
});

test('sólo mide pares abrir/guardar completos y calcula la muestra', () => {
  recordCorrectionKpiEvent({
    sessionId: 's1',
    lineId: 'l1',
    eventType: 'started',
    at: '2026-08-24T20:00:00.000Z',
  });
  recordCorrectionKpiEvent({
    sessionId: 's1',
    lineId: 'l1',
    eventType: 'saved',
    at: '2026-08-24T20:01:00.000Z',
  });
  recordCorrectionKpiEvent({
    sessionId: 's1',
    lineId: 'sin-save',
    eventType: 'started',
    at: '2026-08-24T20:02:00.000Z',
  });

  const result = correctionTimingKpi();
  assert.equal(result.sampleCount, 1);
  assert.equal(result.p50Seconds, 60);
  assert.equal(result.p90Seconds, 60);
  assert.equal(result.withinTargetCount, 1);
});

test('persiste el ciclo revisión -> RFQ -> pedido -> proveedor -> entrega y deriva plazos', () => {
  const base = { projectId: 'obra', revisionId: 'rev-1', flowId: 'revision' };
  recordLifecycleEvent({ ...base, eventType: 'revision_opened', at: '2026-08-20T08:00:00.000Z' });
  recordLifecycleEvent({ ...base, eventType: 'review_closed', at: '2026-08-20T12:00:00.000Z' });
  recordLifecycleEvent({ ...base, eventType: 'rfq_sent', at: '2026-08-20T13:00:00.000Z' });
  recordLifecycleEvent({
    ...base,
    eventType: 'order_placed',
    supplier: 'Proveedor A',
    at: '2026-08-21T13:00:00.000Z',
  });
  recordLifecycleEvent({
    ...base,
    eventType: 'supplier_confirmed',
    supplier: 'Proveedor A',
    at: '2026-08-21T17:00:00.000Z',
  });
  recordLifecycleEvent({
    ...base,
    eventType: 'delivered',
    supplier: 'Proveedor A',
    at: '2026-08-24T13:00:00.000Z',
  });

  const result = procurementLifecycleKpi();
  assert.equal(result.reviewTime.p50Hours, 4);
  assert.equal(result.rfqToOrder.p50Hours, 24);
  assert.equal(result.orderToSupplierConfirmation.p50Hours, 4);
  assert.equal(result.orderToDelivery.p50Hours, 72);
  assert.equal(result.rfqToDelivery.p50Hours, 96);
  assert.equal(result.recentEvents.length, 6);
});

test('repetir el mismo hito es idempotente y no duplica muestras', () => {
  const input = {
    projectId: 'obra',
    revisionId: 'rev-1',
    eventType: 'rfq_sent' as const,
    at: '2026-08-20T13:00:00.000Z',
  };
  assert.equal(recordLifecycleEvent(input).created, true);
  assert.equal(recordLifecycleEvent(input).created, false);
  assert.equal(procurementLifecycleKpi().eventCounts.rfq_sent, 1);
});

test('las altas de vocabulario quedan identificadas una sola vez para medir reutilización', () => {
  assert.equal(recordVocabularyKpiEvent({
    entryId: 'finish-tropicalizado',
    attribute: 'finish',
    at: '2026-08-20T13:00:00.000Z',
  }), true);
  assert.equal(recordVocabularyKpiEvent({
    entryId: 'finish-tropicalizado',
    attribute: 'finish',
    at: '2026-08-20T13:01:00.000Z',
  }), false);
  assert.deepEqual(listVocabularyKpiEntryIds(), ['finish-tropicalizado']);
});

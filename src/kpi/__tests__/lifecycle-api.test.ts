import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { closeKpiEventsDb, procurementLifecycleKpi } from '../events.ts';
import { POST } from '../../../app/api/kpis/lifecycle/route.ts';

beforeEach(() => {
  process.env.KPI_EVENTS_DB = ':memory:';
  closeKpiEventsDb();
});

afterEach(() => {
  closeKpiEventsDb();
  delete process.env.KPI_EVENTS_DB;
});

test('la API registra hitos e identifica repeticiones sin duplicarlas', async () => {
  const body = {
    projectId: 'obra',
    revisionId: 'rev-1',
    flowId: 'revision',
    eventType: 'order_placed',
    supplier: 'Proveedor A',
    at: '2026-08-21T13:00:00.000Z',
  };
  const first = await POST(new Request('http://local/api/kpis/lifecycle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  const repeated = await POST(new Request('http://local/api/kpis/lifecycle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

  assert.equal(first.status, 201);
  assert.equal(repeated.status, 200);
  assert.equal(procurementLifecycleKpi().eventCounts.order_placed, 1);
});

test('la API rechaza un hito desconocido', async () => {
  const response = await POST(new Request('http://local/api/kpis/lifecycle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'obra', revisionId: 'rev-1', eventType: 'inventado' }),
  }));
  assert.equal(response.status, 400);
});

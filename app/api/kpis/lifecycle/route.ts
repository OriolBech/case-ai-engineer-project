import {
  recordLifecycleEvent,
} from '../../../../src/kpi/events.ts';
import type { LifecycleEventType } from '../../../../src/kpi/metrics.ts';

export const runtime = 'nodejs';

const EVENT_TYPES = new Set<LifecycleEventType>([
  'revision_opened',
  'review_closed',
  'rfq_sent',
  'order_placed',
  'supplier_confirmed',
  'delivered',
]);

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  if (typeof body.projectId !== 'string' || !body.projectId.trim()) {
    return Response.json({ error: 'Falta projectId.' }, { status: 400 });
  }
  if (typeof body.revisionId !== 'string' || !body.revisionId.trim()) {
    return Response.json({ error: 'Falta revisionId.' }, { status: 400 });
  }
  if (typeof body.eventType !== 'string' || !EVENT_TYPES.has(body.eventType as LifecycleEventType)) {
    return Response.json({ error: 'Tipo de hito no válido.' }, { status: 400 });
  }
  if (body.at !== undefined && (typeof body.at !== 'string' || !Number.isFinite(Date.parse(body.at)))) {
    return Response.json({ error: 'Fecha no válida.' }, { status: 400 });
  }
  try {
    const result = recordLifecycleEvent({
      projectId: body.projectId,
      revisionId: body.revisionId,
      flowId: typeof body.flowId === 'string' ? body.flowId : undefined,
      eventType: body.eventType as LifecycleEventType,
      supplier: typeof body.supplier === 'string' ? body.supplier : null,
      note: typeof body.note === 'string' ? body.note : '',
      at: typeof body.at === 'string' ? body.at : undefined,
    });
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}

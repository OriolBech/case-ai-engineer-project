import { correctionKpi, listCorrections } from '../../../src/eval/history/corrections.ts';
import { getRunMetrics, listRuns } from '../../../src/eval/history/store.ts';
import {
  correctionTimingKpi,
  listVocabularyKpiEntryIds,
  procurementLifecycleKpi,
  recordCorrectionKpiEvent,
  type CorrectionKpiEventType,
} from '../../../src/kpi/events.ts';
import { deriveKpiDashboard } from '../../../src/kpi/metrics.ts';
import { countVocabularyRuleUses } from '../../lib/mto-history-db.ts';

export const runtime = 'nodejs';

const EVENT_TYPES = new Set<CorrectionKpiEventType>(['started', 'saved']);

export async function GET(): Promise<Response> {
  try {
    const run = listRuns(1)[0] ?? null;
    const metrics = run ? getRunMetrics(run.id) : [];
    const corrections = correctionKpi();
    const promotedEntryIds = listCorrections({ status: 'PROMOTED' })
      .map((correction) => correction.promotedEntryId)
      .filter((id): id is string => id !== null);
    const reusableEntryIds = [...new Set([
      ...promotedEntryIds,
      ...listVocabularyKpiEntryIds(),
    ])];
    return Response.json(
      deriveKpiDashboard({
        run,
        metrics,
        corrections,
        timing: correctionTimingKpi(),
        reuseCount: countVocabularyRuleUses(reusableEntryIds),
        lifecycle: procurementLifecycleKpi(),
      }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  if (typeof body.sessionId !== 'string' || !body.sessionId.trim()) {
    return Response.json({ error: 'Falta sessionId.' }, { status: 400 });
  }
  if (typeof body.lineId !== 'string' || !body.lineId.trim()) {
    return Response.json({ error: 'Falta lineId.' }, { status: 400 });
  }
  if (typeof body.eventType !== 'string' || !EVENT_TYPES.has(body.eventType as CorrectionKpiEventType)) {
    return Response.json({ error: 'eventType debe ser started o saved.' }, { status: 400 });
  }
  try {
    const id = recordCorrectionKpiEvent({
      sessionId: body.sessionId,
      lineId: body.lineId,
      eventType: body.eventType as CorrectionKpiEventType,
    });
    return Response.json({ id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}

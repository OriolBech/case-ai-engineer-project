/**
 * Fachada HTTP de correcciones humanas. SPEC-015.
 *
 * POST → proposeCorrection (evidencia literal en rowSourceText).
 * GET → PENDING + conflictos de valor.
 *
 * El pipeline no lee human_corrections. Necesita runtime Node (node:sqlite).
 */
import {
  approveCorrection,
  listCorrections,
  listValueConflicts,
  proposeCorrection,
  rejectCorrection,
  type NewCorrection,
} from '../../../src/eval/history/corrections.ts';
import { orchestratePromotion } from '../../../src/eval/history/promote.ts';

export const runtime = 'nodejs';

const ATTRS = new Set([
  'name', 'material', 'quality', 'measure', 'length', 'standard', 'finish', 'quantity',
]);

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function GET(): Promise<Response> {
  try {
    const pending = listCorrections({ status: 'PENDING' });
    const approved = listCorrections({ status: 'APPROVED' });
    const conflicts = listValueConflicts();
    return Response.json({ pending, approved, conflicts });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

interface DecisionBody {
  id?: unknown;
  action?: unknown;
  actor?: unknown;
  regressionConfirmed?: unknown;
  promotedEntryId?: unknown;
}

export async function PATCH(req: Request): Promise<Response> {
  let body: DecisionBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof body.id !== 'string' || !body.id.trim()) {
    return Response.json({ error: 'Falta id.' }, { status: 400 });
  }
  if (typeof body.actor !== 'string' || !body.actor.trim()) {
    return Response.json({ error: 'Falta actor.' }, { status: 400 });
  }
  if (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'promote') {
    return Response.json({ error: 'action debe ser approve, reject o promote.' }, { status: 400 });
  }

  try {
    const at = new Date().toISOString();
    if (body.action === 'approve') approveCorrection(body.id, body.actor, at);
    if (body.action === 'reject') rejectCorrection(body.id, body.actor, at);
    if (body.action === 'promote') {
      orchestratePromotion(body.id, {
        regressionPassed: body.regressionConfirmed === true,
        promotedEntryId:
          typeof body.promotedEntryId === 'string' && body.promotedEntryId.trim()
            ? body.promotedEntryId
            : `correction-${body.id}`,
        actor: body.actor,
        at,
      });
    }
    return Response.json({
      ok: true,
      pending: listCorrections({ status: 'PENDING' }),
      approved: listCorrections({ status: 'APPROVED' }),
      conflicts: listValueConflicts(),
    });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 409 });
  }
}

interface PostBody extends Partial<NewCorrection> {
  rowSourceText?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (typeof body.rowRef !== 'string' || !body.rowRef.trim()) {
    return Response.json({ error: 'Falta rowRef.' }, { status: 400 });
  }
  if (typeof body.attribute !== 'string' || !ATTRS.has(body.attribute)) {
    return Response.json({ error: 'Falta o es inválido attribute.' }, { status: 400 });
  }
  if (typeof body.evidence !== 'string' || !body.evidence.trim()) {
    return Response.json({ error: 'Falta evidence (substring literal de la fila).' }, { status: 400 });
  }
  if (typeof body.rationale !== 'string' || !body.rationale.trim()) {
    return Response.json({ error: 'Falta rationale (motivo de la corrección).' }, { status: 400 });
  }
  if (typeof body.rowSourceText !== 'string' || !body.rowSourceText.trim()) {
    return Response.json({ error: 'Falta rowSourceText (texto original de la fila).' }, { status: 400 });
  }

  const input: NewCorrection = {
    runId: typeof body.runId === 'string' ? body.runId : null,
    rowRef: body.rowRef.trim(),
    lineId: typeof body.lineId === 'string' ? body.lineId : null,
    attribute: body.attribute,
    previousValue: typeof body.previousValue === 'string' ? body.previousValue : body.previousValue === null ? null : null,
    correctedValue: typeof body.correctedValue === 'string' ? body.correctedValue : body.correctedValue === null ? null : null,
    evidence: body.evidence.trim(),
    author: typeof body.author === 'string' ? body.author : undefined,
    rationale: body.rationale.trim(),
  };

  try {
    const id = proposeCorrection(input, body.rowSourceText, new Date().toISOString());
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 422 });
  }
}

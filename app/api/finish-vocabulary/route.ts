/**
 * Front-end sobre la tabla de vocabulario de acabado (`src/rules/finish-db.ts`).
 *
 * Misma fachada que `/api/vocabulary`: lee y escribe el log append-only compartido con la CLI.
 */
import {
  addEntry, listChanges, listEntries, retireEntry, resolveFinish,
  type Finish, type FinishAliasKind, type NewFinishAlias,
} from '../../../src/rules/finish-db.ts';
import { suggestFinishEntryId } from '../../../src/rules/finish-vocab-id.ts';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const entries = listEntries({ includeRetired: true });
    const changes = listChanges(50);
    return Response.json({ entries, changes });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface AddBody {
  id?: string;
  alias?: string;
  kind?: FinishAliasKind;
  finish?: Finish | null;
  rationale?: string;
  decidedBy?: string;
  source?: 'client' | 'added';
  evidence?: string;
  allowShortAlias?: boolean;
}

export async function POST(req: Request): Promise<Response> {
  let body: AddBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { id, alias, kind, finish, rationale, decidedBy, source, evidence, allowShortAlias } = body;
  if (!alias || !kind || !rationale || !decidedBy || !evidence) {
    return Response.json(
      { error: 'Faltan campos: alias, kind, rationale, decidedBy y evidence son obligatorios.' },
      { status: 400 },
    );
  }

  const entry: NewFinishAlias = {
    id: id?.trim() || suggestFinishEntryId(alias),
    alias,
    kind,
    finish: kind === 'not_a_finish' ? null : (finish ?? null),
    rationale,
    decidedBy,
    source: source ?? 'added',
    evidence,
  };

  const at = new Date().toISOString().slice(0, 10);
  try {
    addEntry(entry, at, undefined, { allowShortAlias: !!allowShortAlias });
    return Response.json({ ok: true, entries: listEntries({ includeRetired: true }) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}

export async function PUT(req: Request): Promise<Response> {
  let body: { alias?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.alias) return Response.json({ error: 'Falta alias' }, { status: 400 });
  return Response.json({ resolution: resolveFinish(body.alias) });
}

export async function DELETE(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const why = searchParams.get('why') ?? 'Retirada desde el front sin motivo explícito.';
  const by = searchParams.get('by') ?? 'comprador (front)';
  if (!id) return Response.json({ error: 'Falta ?id=' }, { status: 400 });

  const at = new Date().toISOString().slice(0, 10);
  try {
    retireEntry(id, why, by, at);
    return Response.json({ ok: true, entries: listEntries({ includeRetired: true }) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}

/**
 * Front-end sobre la tabla de vocabulario de derivación de material (`src/rules/vocabulary-db.ts`).
 *
 * No añade ninguna lógica nueva: es una fachada HTTP de `listEntries` / `listUncovered` / `addEntry`
 * / `retireEntry`, que ya son la fuente de la verdad (SQLite + log append-only). El pipeline de
 * procesado no llama a esta ruta ni depende de ella: leer o ampliar el vocabulario desde aquí pasa
 * por el mismo `data/vocabulary/material-derivation.log.jsonl` que usa `pnpm run vocab`, así que una
 * entrada añadida desde el front es indistinguible de una añadida por CLI.
 *
 * Necesita el runtime de Node porque `node:sqlite` no corre en el runtime Edge.
 */
import {
  addEntry, listChanges, listEntries, listUncovered, retireEntry, type MatchKind, type Material,
} from '../../../src/rules/vocabulary-db.ts';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const entries = listEntries({ includeRetired: true });
    const uncovered = listUncovered();
    const changes = listChanges(50);
    return Response.json({ entries, uncovered, changes });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface AddBody {
  id?: string;
  matchKind?: MatchKind;
  matchValue?: string;
  material?: Material;
  rationale?: string;
  decidedBy?: string;
  source?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: AddBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { id, matchKind, matchValue, material, rationale, decidedBy, source } = body;
  if (!id || !matchKind || !matchValue || !material || !rationale || !decidedBy) {
    return Response.json(
      { error: 'Faltan campos: id, matchKind, matchValue, material, rationale y decidedBy son obligatorios.' },
      { status: 400 },
    );
  }
  if (material !== 'AC' && material !== 'INOX') {
    return Response.json({ error: `material debe ser AC o INOX, no '${material}'.` }, { status: 400 });
  }

  const at = new Date().toISOString().slice(0, 10);
  try {
    addEntry({ id, matchKind, matchValue, material, rationale, decidedBy, source: source ?? 'UI comprador' }, at);
    return Response.json({ ok: true, entries: listEntries({ includeRetired: true }) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
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

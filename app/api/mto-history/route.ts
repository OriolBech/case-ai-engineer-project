/**
 * Fachada HTTP de `mto-history-db.ts`. `?id=` devuelve el `ProcessSummary` completo de un MTO
 * concreto (para reabrirlo); sin `?id=` devuelve el listado ligero.
 *
 * Necesita el runtime de Node porque `node:sqlite` no corre en el runtime Edge.
 */
import { getProcessedMto, listProcessedMtos } from '../../lib/mto-history-db.ts';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const summary = getProcessedMto(id);
      if (!summary) return Response.json({ error: `No existe el MTO '${id}' en el histórico.` }, { status: 404 });
      return Response.json(summary);
    }
    const limit = Number(searchParams.get('limit') ?? '50');
    return Response.json({ items: listProcessedMtos(limit) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

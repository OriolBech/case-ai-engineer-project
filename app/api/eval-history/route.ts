/**
 * Front-end sobre el histórico de evaluación (SPEC-010, `src/eval/history/`).
 *
 * Sólo lectura: fachada HTTP de `listRuns`. Guardar una ejecución sigue siendo
 * `pnpm run eval -- --save` — esta ruta no dispara ninguna evaluación ni escribe nada.
 *
 * Necesita el runtime de Node porque `node:sqlite` no corre en el runtime Edge.
 */
import { listRuns } from '../../../src/eval/history/store.ts';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') ?? '50');
  try {
    return Response.json({ runs: listRuns(limit) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

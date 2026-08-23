/** Fachada HTTP de `compareRuns` (SPEC-010). Sólo lectura, igual que `../route.ts`. */
import { compareRuns } from '../../../../src/eval/history/compare.ts';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const base = searchParams.get('base');
  const candidate = searchParams.get('candidate');
  if (!base || !candidate) {
    return Response.json({ error: 'Faltan ?base=<run-id> y ?candidate=<run-id>.' }, { status: 400 });
  }
  try {
    return Response.json(compareRuns(base, candidate));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
  }
}

/**
 * Diff entre dos MTOs del histórico. 0 LLM. SPEC-014.
 */
import { toIdentifiables } from '../../../../src/domain/from-output.ts';
import { diffIdentifiableLines } from '../../../../src/revisions/diff-service.ts';
import { projectIdFromFileName } from '../../../../src/revisions/project-id.ts';
import { getRevisionStore } from '../../../../src/revisions/sqlite-store.ts';
import { getProcessedMto } from '../../../lib/mto-history-db.ts';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const previous = searchParams.get('previous');
  const current = searchParams.get('current');
  if (!previous || !current) {
    return Response.json({ error: 'Faltan ?previous=<id> y ?current=<id>.' }, { status: 400 });
  }
  if (previous === current) {
    return Response.json({ error: 'Las dos revisiones deben ser distintas.' }, { status: 400 });
  }

  try {
    const prevSummary = getProcessedMto(previous);
    const currSummary = getProcessedMto(current);
    if (!prevSummary) {
      return Response.json({ error: `No existe la revisión previa '${previous}'.` }, { status: 404 });
    }
    if (!currSummary) {
      return Response.json({ error: `No existe la revisión actual '${current}'.` }, { status: 404 });
    }

    const projectId = projectIdFromFileName(prevSummary.fileName);
    const store = getRevisionStore();
    const exported = store.getRfqExports(projectId, previous);

    const { summary, deltas } = diffIdentifiableLines(
      toIdentifiables(prevSummary.lines),
      toIdentifiables(currSummary.lines),
      exported,
    );

    return Response.json({
      projectId,
      previous: { id: previous, fileName: prevSummary.fileName },
      current: { id: current, fileName: currSummary.fileName },
      summary,
      deltas,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

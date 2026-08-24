/**
 * Registra huellas exportadas a RFQ para una revisión. SPEC-014.
 */
import { fingerprintOf } from '../../../../src/domain/identity.ts';
import { partsFromOutput } from '../../../../src/domain/from-output.ts';
import { projectIdFromFileName } from '../../../../src/revisions/project-id.ts';
import { getRevisionStore } from '../../../../src/revisions/sqlite-store.ts';
import { getProcessedMto } from '../../../lib/mto-history-db.ts';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { revisionId?: string; lineIds?: string[] };
    const { revisionId, lineIds } = body;
    if (!revisionId || !Array.isArray(lineIds) || lineIds.length === 0) {
      return Response.json({ error: 'Faltan revisionId y lineIds.' }, { status: 400 });
    }

    const summary = getProcessedMto(revisionId);
    if (!summary) {
      return Response.json({ error: `No existe la revisión '${revisionId}'.` }, { status: 404 });
    }

    const byId = new Map(summary.lines.map((l) => [l.id, l]));
    const fingerprints: string[] = [];
    for (const id of lineIds) {
      const line = byId.get(id);
      if (!line || line.status !== 'RESUELTA') continue;
      fingerprints.push(fingerprintOf(partsFromOutput(line)));
    }
    if (fingerprints.length === 0) {
      return Response.json({ error: 'Ninguna línea RESUELTA válida para exportar.' }, { status: 400 });
    }

    const projectId = projectIdFromFileName(summary.fileName);
    getRevisionStore().recordRfqExport(projectId, revisionId, fingerprints);
    return Response.json({ recorded: fingerprints.length });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

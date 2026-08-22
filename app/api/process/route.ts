/**
 * Runs the full pipeline (SPEC-001..007) over an uploaded MTO and streams progress as NDJSON, one
 * JSON object per line, so the upload screen can show rows-processed instead of a spinner.
 *
 * Needs the Node runtime: the LLM disk cache and the xlsx reader both touch the filesystem.
 */
import { createLlm, eurPerUsd, LlmError } from '../../../src/lib/llm.ts';
import { processMto } from '../../../src/pipeline/index.ts';
import type { ProcessEvent, ProcessSummary } from '../../lib/api-types.ts';

export const runtime = 'nodejs';
export const maxDuration = 800;

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Falta el fichero .xlsx' }, { status: 400 });
  }
  const fileName = file.name;
  const buffer = Buffer.from(await file.arrayBuffer());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ProcessEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
      try {
        const llm = createLlm();
        const out = await processMto(llm, buffer, {
          concurrency: Number(process.env.CONCURRENCY ?? 6),
          onProgress: (done, total) => send({ type: 'progress', done, total }),
        });

        const fx = eurPerUsd();
        const result: ProcessSummary = {
          fileName,
          rowsIngested: out.rowsIngested,
          rowsSkipped: out.rowsSkipped,
          lines: out.lines,
          rows: out.rows.map((r) => ({
            itemRef: r.itemRef,
            sourceText: r.sourceText,
            sheet: r.sheet,
            rowNumber: r.rowNumber,
          })),
          diagnostics: {
            failedRows: out.analyses
              .filter((a) => a.error)
              .map((a) => ({ rowRef: a.rowRef, kind: a.error!.kind, message: a.error!.message.split('\n')[0] })),
            hallucinations: out.hallucinations,
            rejectedMultiplicity: out.analyses.flatMap((a) =>
              a.rejectedMultiplicity.map((r) => ({
                row: a.rowRef, element: r.element, claimed: r.claimed, reason: r.reason,
              }))),
            outOfFamilyRows: out.outOfFamilyRows,
            policyBacklog: out.policyBacklog,
            gapRows: [...new Set(out.gaps.map((g) => g.rowRef))],
            tierUsage: out.tierUsage,
            critic: {
              rowsRun: out.critic.rowsRun,
              rowsEligible: out.critic.rowsEligible,
              downgraded: out.critic.downgraded.length,
            },
          },
          metrics: {
            latencyMs: out.metrics.latencyMs,
            costEur: fx ? llm.stats.costUsd / fx : 0,
            llmCalls: out.metrics.llmCalls,
            cacheHits: llm.stats.cacheHits,
            pricesConfigured: llm.stats.pricesConfigured && fx > 0,
          },
        };
        send({ type: 'done', result });
      } catch (e) {
        const message =
          e instanceof LlmError ? e.message.split('\n')[0]
          : e instanceof Error ? e.message
          : String(e);
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

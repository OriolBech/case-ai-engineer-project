/**
 * `node scripts/critic-eval.ts` — recall y precisión del crítico (SPEC-006), reproducibles.
 *
 * POR QUÉ EXISTE ESTE SCRIPT. El crítico sólo puede medirse sobre una salida que YA tiene errores:
 * si el extractor acierta todo, cualquier degradación es un falso positivo y el recall no se puede
 * calcular. La única salida con errores conocidos que tenemos es la de `gpt-5.4-mini`, y no se
 * puede volver a generar (sin crédito en OpenAI). Está congelada en
 * `data/eval/critic-baseline-gpt-5.4-mini.json`.
 *
 * QUÉ CUENTA COMO ERROR REAL. No una lista escrita a mano: las líneas que el harness marca como
 * ERROR SILENCIOSO contra `gold.jsonl` — resueltas con al menos una celda CIERTA mal. Es la misma
 * definición del KPI, así que el recall del crítico se mide contra lo que de verdad cuesta dinero.
 *
 * Sólo se llama al modelo del nivel `critic`. El extractor no se llama nunca: es un fichero.
 */
import { readFileSync } from 'node:fs';
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { createLlm, eurPerUsd } from '../src/lib/llm.ts';
import { ingest } from '../src/pipeline/ingest.ts';
import { analysisFromResponse, type Analysis, type RawAnalysis } from '../src/pipeline/analyze.ts';
import { normalizeElement } from '../src/pipeline/normalize.ts';
import { validateRow } from '../src/pipeline/validate.ts';
import { criticiseRow, needsCritic, type CriticRouting } from '../src/pipeline/critic.ts';
import { scoreLine, thresholds, route } from '../src/lib/confidence.ts';
import { loadGold, evaluate } from '../src/eval/harness.ts';
import type { MtoRow, OutputLine } from '../src/pipeline/types.ts';

installErrorHandler();
loadEnv();

const FIXTURE = 'data/eval/critic-baseline-gpt-5.4-mini.json';
const args = process.argv.slice(2);
const routing = (args.find((a) => a.startsWith('--critic='))?.split('=')[1] ?? 'multi_element') as CriticRouting;

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  _provenance: Record<string, unknown>;
  respuestas: Record<string, RawAnalysis>;
};
const { rows } = await ingest('data/input/MTO_tornilleria.xlsx');
const missing = rows.filter((r) => !fixture.respuestas[r.itemRef]).map((r) => r.itemRef);
if (missing.length) throw new Error(`El fixture no cubre las filas ${missing.join(', ')}`);

/** Replays the frozen response through the deterministic stages. No model call. */
function replay(row: MtoRow): { analysis: Analysis; lines: OutputLine[] } {
  const analysis = analysisFromResponse(fixture.respuestas[row.itemRef], row);
  return { analysis, lines: validateRow(analysis, analysis.elements.map(normalizeElement), row) };
}

/** Same order as the orchestrator: validate -> critic -> score/route. */
function finish(lines: OutputLine[]): OutputLine[] {
  const t = thresholds();
  for (const line of lines) {
    line.confidence = scoreLine(line.attributes);
    if (route(line, t) === 'review' && line.status === 'RESUELTA') {
      line.status = 'REVISION_MANUAL';
      line.reasons.push({
        code: 'LOW_CONFIDENCE', kind: 'LOW_CONFIDENCE',
        message: 'Varios datos son inferidos: conviene revisarlo', attribute: null,
      });
    }
  }
  return lines;
}

const gold = loadGold();
const before = evaluate(finish(rows.flatMap((r) => replay(r).lines)), gold, 'gpt-5.4-mini congelado');
const truth = new Set(before.silentErrorRate.lines);

const llm = createLlm();
const explanations = new Map<string, string>();
const criticised: OutputLine[] = [];
let eligible = 0;
for (const row of rows) {
  const { analysis, lines } = replay(row);
  if (!needsCritic(analysis, routing)) { criticised.push(...lines); continue; }
  eligible++;
  const c = await criticiseRow(llm, row, analysis, lines, routing);
  for (const id of c.downgraded) {
    const l = c.lines.find((x) => x.id === id);
    explanations.set(id, l?.reasons.at(-1)?.message ?? '');
  }
  criticised.push(...c.lines);
}
const after = evaluate(finish(criticised), gold, 'gpt-5.4-mini + crítico');

const degraded = [...explanations.keys()];
const hits = degraded.filter((id) => truth.has(id));
const falsePos = degraded.filter((id) => !truth.has(id));
const missed = [...truth].filter((id) => !degraded.includes(id));
const pc = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');

console.log(`\n=== crítico · ${llm.config('critic').model} · enrutado '${routing}'`);
console.log(`  entrada                ${FIXTURE}`);
console.log(`  errores reales         ${truth.size}: ${[...truth].join(', ')}`);
console.log(`  filas al crítico       ${eligible}/${rows.length}`);
console.log(`  degradadas             ${degraded.length}: ${degraded.join(', ') || '-'}`);
console.log(`  aciertos               ${hits.length}: ${hits.join(', ') || '-'}`);
console.log(`  falsos positivos       ${falsePos.length}: ${falsePos.join(', ') || '-'}`);
console.log(`  se escapan             ${missed.length}: ${missed.join(', ') || '-'}`);
console.log(`  RECALL                 ${pc(hits.length, truth.size)}  (${hits.length}/${truth.size})`);
console.log(`  PRECISIÓN              ${pc(hits.length, degraded.length)}  (${hits.length}/${degraded.length})`);
console.log('\n  efecto en el KPI (sin crítico -> con crítico):');
const row2 = (k: string, a: string, b: string) => console.log(`    ${k.padEnd(22)} ${a.padStart(12)} -> ${b}`);
row2('error silencioso', `${before.silentErrorRate.bad} (${before.silentErrorRate.pct.toFixed(1)}%)`,
  `${after.silentErrorRate.bad} (${after.silentErrorRate.pct.toFixed(1)}%)`);
row2('autonomía útil', `${before.usefulAutonomy.pct.toFixed(1)}%`, `${after.usefulAutonomy.pct.toFixed(1)}%`);
row2('ruido en cola', `${before.queueNoise.pct.toFixed(1)}%`, `${after.queueNoise.pct.toFixed(1)}%`);
console.log(`\n  coste                  $${llm.stats.costUsd.toFixed(5)}` +
  `${eurPerUsd() ? ` (${(llm.stats.costUsd / eurPerUsd()).toFixed(5)} €)` : ''}` +
  `  ${llm.stats.calls} llamadas, ${llm.stats.cacheHits} de caché`);

if (falsePos.length) {
  console.log('\n  POR QUÉ DEGRADÓ LO QUE ESTABA BIEN (lo que hay que endurecer):');
  for (const id of falsePos) console.log(`    ${id}: ${explanations.get(id)}`);
}
if (hits.length) {
  console.log('\n  aciertos, con su motivo:');
  for (const id of hits) console.log(`    ${id}: ${explanations.get(id)}`);
}

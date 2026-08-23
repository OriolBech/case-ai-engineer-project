/**
 * `pnpm run sweep` — evalúa el pipeline completo con varios modelos y compara.
 *
 * Crítico apagado: aquí se mide la calidad del EXTRACTOR. Mezclar las dos etapas haría imposible
 * saber a quién atribuir un fallo.
 *
 * Un modelo que revienta no aborta el barrido: se anota y se sigue. Con modelos abiertos eso pasa
 * —el esquema estricto es un contrato más flojo de lo que parece— y es en sí mismo un resultado.
 */
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

/**
 * Progreso a fichero con appendFileSync, no a stdout.
 *
 * stdout se bufferea cuando va a un pipe o a un fichero, así que durante ocho minutos el barrido no
 * mostró nada y no había forma de saber si un modelo era lento o estaba colgado. No poder observarlo
 * era tan problema como el cuelgue.
 */
const LOG = 'eval/reports/sweep.log';
const log = (line: string): void => {
  appendFileSync(LOG, `${line}\n`);
  console.log(line);
};
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { createLlm, eurPerUsd } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
import { loadGold, evaluate } from '../src/eval/harness.ts';

installErrorHandler();
loadEnv();
process.env.LLM_CACHE = process.env.LLM_CACHE ?? 'on';

/** provider:model:in:out — precios de openrouter.ai/api/v1/models, 2026-08-22. */
const DEFAULT_MODELS = [
  'openai:gpt-5.5:5.00:30.00:0.50',
  'openrouter:moonshotai/kimi-k3:3.000:15.000',
  'openrouter:openai/gpt-oss-120b:0.03:0.17',
  'openrouter:qwen/qwen3-235b-a22b-2507:0.090:0.550',
  'openrouter:deepseek/deepseek-v3.2:0.269:0.400',
  'openrouter:z-ai/glm-5.2:0.966:3.036',
  'openrouter:deepseek/deepseek-v4-pro-0813:1.188:3.564',
  'openrouter:qwen/qwen3.8-max:2.000:6.000',
];

const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS;
mkdirSync('eval/reports', { recursive: true });
writeFileSync(LOG, `barrido ${models.length} modelos · timeout ${process.env.LLM_TIMEOUT_MS ?? '120000'}ms\n`);
const gold = loadGold();
const fx = eurPerUsd() || 1;

interface Row {
  spec: string; model: string; ok: boolean; error?: string;
  silentPct?: number; silentCount?: number; autonomy?: number; split?: number;
  noise?: number; hallucinations?: number; eurPerRow?: number; secPerRow?: number;
  perAttr?: Record<string, number>;
}
const results: Row[] = [];

for (const spec of models) {
  process.env.LLM_MAIN = spec;
  process.env.LLM_CHEAP = spec;
  // Mismo criterio que src/lib/tiers.ts: los precios se leen desde la derecha, porque los ids de
  // OpenRouter llevan dos puntos. Partir por posición daba etiquetas como 'gpt-5.5:5.00'.
  const parts = spec.split(':').slice(1);
  const isNum = (v: string) => v.trim() !== '' && Number.isFinite(Number(v));
  let n = 0;
  while (n < 3 && parts.length - n > 1 && isNum(parts[parts.length - 1 - n])) n++;
  const model = parts.slice(0, parts.length - n).join(':');
  const t0 = Date.now();
  log(`→ ${model}`);
  try {
    const llm = createLlm();
    const out = await processMto(llm, 'data/input/MTO_tornilleria.xlsx', {
      concurrency: Number(process.env.CONCURRENCY ?? 8),
      routing: 'always_main',
      criticRouting: 'off',
    });
    const r = evaluate(out.lines, gold, model);
    results.push({
      spec, model, ok: true,
      silentPct: r.silentErrorRate.pct,
      silentCount: r.silentErrorRate.bad,
      autonomy: r.usefulAutonomy.pct,
      split: r.splitFidelity.pct,
      noise: r.queueNoise.pct,
      hallucinations: out.hallucinations.length,
      eurPerRow: llm.stats.costUsd / fx / out.rowsIngested,
      secPerRow: llm.stats.latencyMsTotal / 1000 / out.rowsIngested,
      perAttr: Object.fromEntries(Object.entries(r.perAttribute).map(([k, v]) => [k, v.pctC])),
    });
    log(`  ${model}: err.sil ${r.silentErrorRate.pct.toFixed(0)}% (${r.silentErrorRate.bad})` +
      `  aut ${r.usefulAutonomy.pct.toFixed(0)}%  split ${r.splitFidelity.pct.toFixed(0)}%` +
      `  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    results.push({ spec, model, ok: false, error: msg });
    log(`  ${model}: ✖ ${msg.slice(0, 110)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}

const okRows = results.filter((r) => r.ok);
okRows.sort((a, b) => (a.silentPct! - b.silentPct!) || (b.autonomy! - a.autonomy!));

const pad = (s: string, n: number) => s.padEnd(n);
const num = (v: number | undefined, d = 1, w = 6) => (v === undefined ? '—' : v.toFixed(d)).padStart(w);

console.log(`\n${pad('modelo', 34)}${'err.sil'.padStart(8)}${'(n)'.padStart(5)}${'auton'.padStart(8)}${'split'.padStart(8)}${'ruido'.padStart(8)}${'aluc'.padStart(6)}${'€/fila'.padStart(10)}${'s/fila'.padStart(8)}`);
console.log('-'.repeat(95));
for (const r of okRows) {
  console.log(
    pad(r.model, 34) + num(r.silentPct, 1) + '%' + String(r.silentCount).padStart(4) +
    num(r.autonomy, 1) + '%' + num(r.split, 0) + '%' + num(r.noise, 1) + '%' +
    String(r.hallucinations).padStart(6) +
    (r.eurPerRow! < 0.001 ? r.eurPerRow!.toExponential(1) : r.eurPerRow!.toFixed(4)).padStart(10) +
    num(r.secPerRow, 1, 8),
  );
}
for (const r of results.filter((x) => !x.ok)) console.log(`${pad(r.model, 34)}  ✖ ${r.error}`);

const attrs = ['name', 'material', 'quality', 'measure', 'length', 'standard', 'finish'];
console.log(`\n${pad('desglose por atributo (celdas ciertas)', 34)}${attrs.map((a) => a.slice(0, 6).padStart(8)).join('')}`);
console.log('-'.repeat(95));
for (const r of okRows) {
  console.log(pad(r.model, 34) + attrs.map((a) => `${(r.perAttr?.[a] ?? 0).toFixed(0)}%`.padStart(8)).join(''));
}

writeFileSync('eval/reports/sweep.json', JSON.stringify(results, null, 2));
console.log('\n-> eval/reports/sweep.json');

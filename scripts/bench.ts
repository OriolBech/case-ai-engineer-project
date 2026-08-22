/**
 * Latencia y coste con repeticiones. `node scripts/bench.ts [reps]`
 *
 * Existe porque la primera medición de latencia que hice (24,8 s/fila con gpt-5.5) era un valor
 * atípico: la siguiente dio 7,4 s en las mismas condiciones. Una sola medida de latencia contra una
 * API no es una medida, y sobre ella había construido un argumento de arquitectura.
 */
import { loadEnv } from '../src/lib/env.ts';
import { installErrorHandler } from '../src/lib/cli.ts';
import { createLlm, eurPerUsd } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
import { loadGold, evaluate } from '../src/eval/harness.ts';

installErrorHandler();
loadEnv();
process.env.LLM_CACHE = 'off';
const reps = Number(process.argv[2] ?? 3);
const gold = loadGold();
const fx = eurPerUsd();

const CONFIGS: { label: string; main: string; cheap: string; routing: 'always_main' | 'always_cheap' | 'mixed' }[] = [
  { label: 'gpt-5.5', main: 'gpt-5.5', cheap: 'gpt-5.5', routing: 'always_main' },
  { label: 'mixto 5.5/5.4', main: 'gpt-5.5', cheap: 'gpt-5.4', routing: 'mixed' },
  { label: 'gpt-5.4', main: 'gpt-5.4', cheap: 'gpt-5.4', routing: 'always_main' },
];

const stats = (xs: number[]) => ({
  mean: xs.reduce((a, b) => a + b, 0) / xs.length,
  min: Math.min(...xs),
  max: Math.max(...xs),
});

for (const c of CONFIGS) {
  process.env.OPENAI_MODEL = c.main;
  process.env.OPENAI_MODEL_CHEAP = c.cheap;
  const secs: number[] = [];
  const eur: number[] = [];
  const silent: number[] = [];
  const auto: number[] = [];
  const split: number[] = [];

  for (let i = 0; i < reps; i++) {
    const llm = createLlm();
    const out = await processMto(llm, 'data/input/MTO_tornilleria.xlsx', {
      concurrency: Number(process.env.CONCURRENCY ?? 15),
      routing: c.routing,
    });
    const r = evaluate(out.lines, gold, c.label);
    secs.push(llm.stats.latencyMsTotal / 1000 / out.rowsIngested);
    eur.push(llm.stats.costUsd / fx / out.rowsIngested);
    silent.push(r.silentErrorRate.pct);
    auto.push(r.usefulAutonomy.pct);
    split.push(r.splitFidelity.pct);
  }

  const s = stats(secs);
  const e = stats(eur);
  console.log(`\n${c.label}  (${reps} repeticiones)`);
  console.log(`  s de modelo / fila   media ${s.mean.toFixed(1)}   rango ${s.min.toFixed(1)}–${s.max.toFixed(1)}`);
  console.log(`  €/fila               media ${e.mean.toFixed(4)}  rango ${e.min.toFixed(4)}–${e.max.toFixed(4)}`);
  console.log(`  error silencioso     ${silent.map((x) => x.toFixed(0) + '%').join(' ')}`);
  console.log(`  autonomía útil       ${auto.map((x) => x.toFixed(0) + '%').join(' ')}`);
  console.log(`  split fidelity       ${split.map((x) => x.toFixed(0) + '%').join(' ')}`);
}

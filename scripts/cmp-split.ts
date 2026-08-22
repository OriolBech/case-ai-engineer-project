import { loadEnv } from '../src/lib/env.ts';
import { createLlm } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
loadEnv();
const F = 'data/synthetic/MTO_sintetico.xlsx';
// Ambos por OpenRouter y con el MISMO prompt: es la única forma de atribuir la diferencia al
// modelo. La medida anterior de 71 líneas con gpt-5.5 se hizo con un prompt distinto, así que no
// era comparable — y casi la usé para concluir sobre el modelo.
const specs = {
  'gpt-oss-120b': 'openrouter:openai/gpt-oss-120b:0.03:0.17',
  'kimi-k3': 'openrouter:moonshotai/kimi-k3:3:15',
};
/** Filas multi-elemento por diseño del set sintético (docs/09): E1, K1, K2, K3. */
const EXPECTED: Record<string, number> = { '35': 3, '62': 3, '63': 3, '64': 2 };
const counts: Record<string, Map<string, number>> = {};
for (const [label, spec] of Object.entries(specs)) {
  process.env.LLM_MAIN = spec; process.env.LLM_CHEAP = spec;
  const out = await processMto(createLlm(), F, { concurrency: 12, routing: 'always_main', criticRouting: 'off' });
  const m = new Map<string, number>();
  for (const l of out.lines) m.set(l.rowRef, (m.get(l.rowRef) ?? 0) + 1);
  counts[label] = m;
  console.log(`${label}: ${out.lines.length} líneas`);
}
const [a, b] = Object.keys(specs);
const rows = [...new Set([...counts[a].keys(), ...counts[b].keys()])].sort((x, y) => Number(x) - Number(y));
const diffs = rows.filter((r) => counts[a].get(r) !== counts[b].get(r));
console.log(`\nfilas donde los dos modelos discrepan: ${diffs.length}`);
for (const r of diffs) console.log(`  fila ${r}: ${a}=${counts[a].get(r) ?? 0}  ${b}=${counts[b].get(r) ?? 0}`);

console.log('\nfilas multi-elemento por diseño, contra lo producido:');
for (const [r, exp] of Object.entries(EXPECTED)) {
  const ga = counts[a].get(r) ?? 0, gb = counts[b].get(r) ?? 0;
  const mark = (n: number) => (n === exp ? '✔' : '✖');
  console.log(`  fila ${r}: esperado ${exp}  ${a}=${ga} ${mark(ga)}  ${b}=${gb} ${mark(gb)}`);
}
const total = (m: Map<string, number>) => [...m.values()].reduce((x, y) => x + y, 0);
console.log(`\nlíneas totales: ${a}=${total(counts[a])}  ${b}=${total(counts[b])}  (esperadas por diseño: 71)`);

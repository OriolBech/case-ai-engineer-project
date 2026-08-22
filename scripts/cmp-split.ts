import { loadEnv } from '../src/lib/env.ts';
import { createLlm } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
loadEnv();
const F = 'data/synthetic/MTO_sintetico.xlsx';
// Ambos por OpenRouter y con el MISMO prompt: es la única forma de atribuir la diferencia al
// modelo. La medida anterior de 71 líneas con gpt-5.5 se hizo con un prompt distinto, así que no
// era comparable — y casi la usé para concluir sobre el modelo.
const ALL_SPECS: Record<string, string> = {
  'gpt-oss-120b': 'openrouter:openai/gpt-oss-120b:0.03:0.17',
  'kimi-k3': 'openrouter:moonshotai/kimi-k3:3:15',
};
// Con un solo modelo el script mide el efecto de un cambio de PROMPT sobre ese modelo (misma
// atribución: cambia una cosa). Con dos, compara modelos. Lo que no vale es mezclar las dos cosas:
// una medida de gpt-oss con el prompt nuevo al lado de una de kimi con el viejo no es comparable.
const picked = process.argv.slice(2).filter((a) => a in ALL_SPECS);
const concurrency = Number(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 6);
const specs: Record<string, string> = picked.length
  ? Object.fromEntries(picked.map((k) => [k, ALL_SPECS[k]]))
  : ALL_SPECS;
/** Filas multi-elemento por diseño del set sintético (docs/09): E1, K1, K2, K3. */
const EXPECTED: Record<string, number> = { '35': 3, '62': 3, '63': 3, '64': 2 };
const counts: Record<string, Map<string, number>> = {};
for (const [label, spec] of Object.entries(specs)) {
  process.env.LLM_MAIN = spec; process.env.LLM_CHEAP = spec;
  const out = await processMto(createLlm(), F, { concurrency, routing: 'always_main', criticRouting: 'off' });
  const m = new Map<string, number>();
  for (const l of out.lines) m.set(l.rowRef, (m.get(l.rowRef) ?? 0) + 1);
  counts[label] = m;
  // Las filas que fallaron se dicen SIEMPRE, antes del recuento. Una pasada con errores de
  // proveedor produce una línea por fila caída en lugar de tres, y sin esta línea eso se lee
  // exactamente igual que un modelo que ha dejado de partir sets. Ya pasó: dos ejecuciones a la
  // vez agotaron el rate limit y el resultado parecía una regresión de prompt.
  const failed = out.analyses.filter((a) => a.error);
  if (failed.length) {
    console.log(`${label}: ${failed.length} FILAS CAÍDAS — la medida NO es válida`);
    for (const a of failed) console.log(`    fila ${a.rowRef}: ${a.error!.kind} ${a.error!.message.slice(0, 120)}`);
  }
  console.log(`${label}: ${out.lines.length} líneas${failed.length ? ' (inválido)' : ''}`);
}
const [a, b] = Object.keys(specs);
if (b) {
const rows = [...new Set([...counts[a].keys(), ...counts[b].keys()])].sort((x, y) => Number(x) - Number(y));
const diffs = rows.filter((r) => counts[a].get(r) !== counts[b].get(r));
console.log(`\nfilas donde los dos modelos discrepan: ${diffs.length}`);
for (const r of diffs) console.log(`  fila ${r}: ${a}=${counts[a].get(r) ?? 0}  ${b}=${counts[b].get(r) ?? 0}`);
}

console.log('\nfilas multi-elemento por diseño, contra lo producido:');
const mark = (n: number, exp: number) => (n === exp ? '✔' : '✖');
for (const [r, exp] of Object.entries(EXPECTED)) {
  const cols = Object.keys(specs)
    .map((k) => { const n = counts[k].get(r) ?? 0; return `${k}=${n} ${mark(n, exp)}`; })
    .join('  ');
  console.log(`  fila ${r}: esperado ${exp}  ${cols}`);
}
const total = (m: Map<string, number>) => [...m.values()].reduce((x, y) => x + y, 0);
const totals = Object.keys(specs).map((k) => `${k}=${total(counts[k])}`).join('  ');
console.log(`\nlíneas totales: ${totals}  (esperadas por diseño: 71)`);

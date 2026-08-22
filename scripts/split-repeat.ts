/**
 * `node scripts/split-repeat.ts [--rows=35,62,63,64] [--passes=3] [--file=...]`
 *
 * Cuántos elementos saca el extractor de las MISMAS filas, varias veces.
 *
 * POR QUÉ EXISTE. Una sola pasada no distingue "el prompt arregló esta fila" de "el modelo es
 * inestable en esta fila". Al cambiar el prompt de separadores, la fila 63 del set sintético pasó de
 * 1 a 3 elementos —lo buscado— y la 35 de 3 a 1 en la misma pasada. Con una medida cada una, las dos
 * lecturas son igual de defendibles, y el proyecto ya ha pagado tres veces por medir una sola vez.
 *
 * Corre SIEMPRE con la caché apagada: la caché devolvería la misma respuesta N veces, que es
 * exactamente lo contrario de lo que se quiere medir. Se fuerza aquí, no se confía en el entorno.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { createLlm } from '../src/lib/llm.ts';
import { ingest } from '../src/pipeline/ingest.ts';
import { analyzeRow } from '../src/pipeline/analyze.ts';

installErrorHandler();
loadEnv();
process.env.LLM_CACHE = 'off';

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const file = arg('file') ?? 'data/synthetic/MTO_sintetico.xlsx';
const passes = Number(arg('passes') ?? 3);
const wanted = (arg('rows') ?? '35,62,63,64').split(',');
/** Elementos por diseño del set sintético (docs/09): E1, K1, K2, K3. */
const EXPECTED: Record<string, number> = { '35': 3, '62': 3, '63': 3, '64': 2 };

const llm = createLlm();
const { rows } = await ingest(file);
const targets = wanted.map((r) => rows.find((x) => x.itemRef === r)).filter((r) => r !== undefined);
if (targets.length !== wanted.length) throw new Error(`Filas no encontradas en ${file}`);

const counts = new Map<string, number[]>();
const failures = new Map<string, string[]>();
for (let p = 1; p <= passes; p++) {
  for (const row of targets) {
    const a = await analyzeRow(llm, row);
    if (a.error) {
      failures.set(row.itemRef, [...(failures.get(row.itemRef) ?? []), a.error.kind]);
      continue;
    }
    counts.set(row.itemRef, [...(counts.get(row.itemRef) ?? []), a.elements.length]);
  }
  console.log(`pasada ${p}/${passes} hecha`);
}

console.log(`\n=== ${llm.config('main').model} · ${passes} pasadas · caché OFF · ${file}`);
console.log('  fila  esperado  pasadas        estable');
for (const row of targets) {
  const got = counts.get(row.itemRef) ?? [];
  const exp = EXPECTED[row.itemRef];
  const stable = got.length > 0 && got.every((n) => n === got[0]);
  const ok = got.filter((n) => n === exp).length;
  console.log(
    `  ${row.itemRef.padEnd(5)} ${String(exp ?? '?').padEnd(9)} ${got.join(' · ').padEnd(14)} ` +
    `${stable ? 'sí' : 'NO'}   ${exp === undefined ? '' : `acierta ${ok}/${got.length}`}`,
  );
  const f = failures.get(row.itemRef);
  if (f?.length) console.log(`        ${f.length} pasada(s) caídas en el proveedor (${f.join(', ')}): esas no cuentan`);
}
// Una fila inestable NO se puede usar para atribuir un cambio de prompt: la varianza del modelo es
// mayor que el efecto que se quiere medir.
const unstable = targets.filter((r) => {
  const g = counts.get(r.itemRef) ?? [];
  return g.length > 1 && !g.every((n) => n === g[0]);
});
console.log(
  unstable.length
    ? `\n  INESTABLES: ${unstable.map((r) => r.itemRef).join(', ')}. No sirven para atribuir un cambio de prompt.`
    : '\n  todas estables entre pasadas.',
);
console.log(`  coste $${llm.stats.costUsd.toFixed(5)} · ${llm.stats.calls} llamadas`);

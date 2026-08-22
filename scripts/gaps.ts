/** `npm run gaps [xlsx]` — el backlog de políticas de un MTO. Determinista sobre la caché. */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { createLlm } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';

installErrorHandler();
loadEnv();
const file = process.argv[2] ?? 'data/input/MTO_tornilleria.xlsx';
const llm = createLlm();
const out = await processMto(llm, file, {
  concurrency: Number(process.env.CONCURRENCY ?? 8),
  routing: 'always_main',
  criticRouting: 'off',
});

const rowsWithGaps = new Set(out.gaps.map((g) => g.rowRef));
console.log(`\n${file}`);
console.log(`  filas ${out.rowsIngested} · líneas ${out.lines.length}`);
console.log(`  huecos ${out.gaps.length} en ${rowsWithGaps.size} filas (${((100 * rowsWithGaps.size) / out.rowsIngested).toFixed(0)}% de las filas)`);
console.log(`  decisiones que debe el proyecto: ${out.policyBacklog.length}\n`);

for (const b of out.policyBacklog) {
  console.log(`  ${b.kind}  ${b.attribute ?? '-'} = ${JSON.stringify(b.value)}`);
  console.log(`    filas: ${b.rows.join(', ')}  (${b.rows.length})`);
  console.log(`    ${b.detail}\n`);
}

/** `pnpm run eval:history [-- --limit=20]` — las ejecuciones guardadas, de la más reciente a la más antigua. */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { listRuns } from '../src/eval/history/store.ts';

installErrorHandler();
loadEnv();

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '20');

const runs = listRuns(limit);
if (!runs.length) {
  console.log('\nHistórico vacío. Guarda la primera ejecución con: pnpm run eval -- --save\n');
  process.exit(0);
}

console.log(`\nHISTÓRICO DE EVALUACIÓN · ${runs.length} ejecución(es)\n`);
for (const r of runs) {
  const dirty = r.gitDirty ? '  [DIRTY]' : '';
  const commit = r.gitCommit ? r.gitCommit.slice(0, 10) : '(sin commit)';
  const label = r.label ? `  "${r.label}"` : '';
  const cost = r.costEur === null ? 'coste desconocido' : `${r.costEur.toFixed(4)} €`;
  console.log(`  ${r.id}${label}`);
  console.log(`    ${r.createdAt}  ${commit}${dirty}  ${r.model} (${r.provider})  routing=${r.routing} critic=${r.criticRouting}`);
  console.log(`    dataset ${r.datasetName} (${r.datasetFingerprint.slice(0, 12)}…)  filas ${r.rows} · gold ${r.goldLines} · sistema ${r.systemLines}`);
  console.log(`    ${cost}  ·  latencia ${(r.latencyMs / 1000).toFixed(1)}s\n`);
}
console.log('  pnpm run eval:compare -- <run-base> <run-candidato>   para comparar dos\n');

/** `pnpm run eval:compare -- <run-base> <run-candidato>` */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { compareRuns } from '../src/eval/history/compare.ts';
import { getRun } from '../src/eval/history/store.ts';

installErrorHandler();
loadEnv();

const [baseId, candidateId] = process.argv.slice(2);
if (!baseId || !candidateId) {
  throw new Error('Uso: pnpm run eval:compare -- <run-base> <run-candidato>\nIds con: pnpm run eval:history');
}

const base = getRun(baseId);
const candidate = getRun(candidateId);
if (!base) throw new Error(`No existe la ejecución '${baseId}'. Consulta: pnpm run eval:history`);
if (!candidate) throw new Error(`No existe la ejecución '${candidateId}'. Consulta: pnpm run eval:history`);

const cmp = compareRuns(baseId, candidateId);

console.log(`\n=== ${base.label ?? base.id}  ->  ${candidate.label ?? candidate.id} ===\n`);
console.log('CONTEXTO');
console.log(`  base       ${base.createdAt}  ${base.gitCommit?.slice(0, 10) ?? '(sin commit)'}${base.gitDirty ? ' [DIRTY]' : ''}  ${base.model}`);
console.log(
  `  candidata  ${candidate.createdAt}  ${candidate.gitCommit?.slice(0, 10) ?? '(sin commit)'}${candidate.gitDirty ? ' [DIRTY]' : ''}  ${candidate.model}`,
);
console.log(`  dataset    base ${base.datasetFingerprint.slice(0, 12)}…   candidata ${candidate.datasetFingerprint.slice(0, 12)}…`);

if (!cmp.comparable) {
  console.log('\n!! NO COMPARABLE');
  for (const i of cmp.incompatibilities) console.log(`   - ${i}`);
  console.log('   Se muestran los números igualmente, pero ninguno se declara mejora ni regresión.');
} else {
  console.log('\n  misma población de prueba (dataset y políticas): comparación válida.');
}

console.log('\nMÉTRICAS');
for (const m of cmp.metrics) {
  const arrow = m.direction === 'improved' ? '↑ mejora' : m.direction === 'regressed' ? '↓ regresión' : '= sin cambio';
  const nd = m.baseDenominator !== null ? `   [${m.baseNumerator}/${m.baseDenominator} -> ${m.candidateNumerator}/${m.candidateDenominator}]` : '';
  const delta = `${m.delta >= 0 ? '+' : ''}${m.delta.toFixed(3)}`;
  console.log(`  ${m.name.padEnd(22)} ${m.base.toFixed(3).padStart(10)} -> ${m.candidate.toFixed(3).padStart(10)}  (Δ ${delta})  ${arrow}${nd}`);
}

const ORDER = { regressed: 0, split_changed: 1, status_changed: 2, fixed: 3 } as const;
if (cmp.changedLines.length) {
  console.log(`\nLÍNEAS QUE EXPLICAN EL DELTA · ${cmp.changedLines.length}`);
  for (const l of [...cmp.changedLines].sort((a, b) => ORDER[a.change] - ORDER[b.change])) {
    console.log(`  [${l.change}]  fila ${l.rowRef}  gold ${l.goldId ?? '?'}`);
    for (const d of l.details) console.log(`     ${d}`);
  }
} else {
  console.log('\n  ninguna línea cambió de estado o de resultado entre ambas ejecuciones.');
}
console.log('');

/** Pipeline completo sobre un MTO. `node scripts/run.ts [xlsx]` */
import { writeFileSync } from 'node:fs';
import { loadEnv } from '../src/lib/env.ts';
import { installErrorHandler } from '../src/lib/cli.ts';
import { createLlm } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
import { ATTRIBUTE_KEYS } from '../src/pipeline/types.ts';
import { describeOverrides } from '../src/rules/policies.ts';

installErrorHandler();
loadEnv();
const file = process.argv[2] ?? 'data/input/MTO_tornilleria.xlsx';
const llm = createLlm();
const out = await processMto(llm, file, { concurrency: Number(process.env.CONCURRENCY ?? 12) });

const res = out.lines.filter((l) => l.status === 'RESUELTA');
const rev = out.lines.filter((l) => l.status === 'REVISION_MANUAL');
const pc = (n: number) => `${((100 * n) / out.lines.length).toFixed(0)}%`;

console.log(`\n${file}`);
if (out.policyOverrides.length) {
  console.log(`políticas      NO por defecto -> ${describeOverrides(out.policyOverrides)}`);
}
console.log(`filas          ${out.rowsIngested} (descartadas ${out.rowsSkipped})`);
console.log(`líneas         ${out.lines.length}`);
console.log(`RESUELTA       ${res.length}  ${pc(res.length)}`);
console.log(`REVISION       ${rev.length}  ${pc(rev.length)}`);
console.log(`fuera familia  ${out.outOfFamilyRows.length}  ${out.outOfFamilyRows.join(', ')}`);
console.log(`alucinaciones  ${out.hallucinations.length}`);
console.log(`llamadas LLM   ${out.metrics.llmCalls} (cache ${llm.stats.cacheHits})`);
console.log(`al crítico     ${(100 * out.metrics.criticRunRatio).toFixed(0)}% de las líneas` +
  `  (${out.critic.rowsRun}/${out.critic.rowsEligible} filas elegibles)`);
if (out.critic.failures.length) {
  console.log(`!! EL CRÍTICO NO PUDO REVISAR ${out.critic.failures.length} fila(s). Esas líneas salen SIN red de seguridad:`);
  for (const f of out.critic.failures) console.log(`     fila ${f.row}: ${f.reason.slice(0, 120)}`);
}
console.log(`latencia       ${(out.metrics.latencyMs / 1000).toFixed(1)}s`);

const rejectedMeasures = out.lines.filter((l) => l.attributes.measure.rule === 'P-10:bare_measure_rejected'
  || l.policiesApplied.includes('P-10'));
if (rejectedMeasures.length) {
  console.log(`\nmedidas descartadas por P-10 (número desnudo dentro de un set): ${rejectedMeasures.length}`);
  for (const l of rejectedMeasures) {
    const q = l.attributes.quality;
    console.log(`  ${l.id} ${l.attributes.name.normalized}: ${l.attributes.measure.rule}` +
      (q.rule?.startsWith('P-11:') ? ` · recuperado como calidad ${q.normalized} (${q.rule})` : '') +
      ` · medida final ${l.attributes.measure.normalized} (${l.attributes.measure.provenance})`);
  }
}

const byReason = new Map<string, number>();
for (const l of rev) for (const r of l.reasons) byReason.set(r.code, (byReason.get(r.code) ?? 0) + 1);
console.log('\nmotivos de revisión:');
for (const [c, n] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${c}`);

console.log('\nlíneas:');
let lastRow = '';
for (const l of out.lines) {
  if (l.rowRef !== lastRow) { console.log(`\n  fila ${l.rowRef}`); lastRow = l.rowRef; }
  const a = ATTRIBUTE_KEYS.map((k) => {
    const v = l.attributes[k];
    const mark = { extrapolated: 'ᵉ', derived: 'ᵈ', inferred: 'ⁱ', extracted_uncatalogued: 'ᵘ', not_applicable: '', absent: '', extracted: '', table_normalized: '', exact_catalog: '', human_corrected: 'ᴴ' }[v.provenance];
    return `${v.normalized ?? '—'}${mark}`;
  }).join(' · ');
  const st = l.status === 'RESUELTA' ? '✅' : '⚠️ ' + l.reasons.map((r) => r.code).join('+');
  console.log(`    ${l.id.padEnd(6)} c=${l.confidence.toFixed(2)} q=${String(l.quantity ?? '—').padStart(4)} ${a}   ${st}`);
}
writeFileSync('data/output/lines.json', JSON.stringify(out.lines, null, 2));
console.log('\n-> data/output/lines.json');

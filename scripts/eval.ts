/**
 * `npm run eval [-- --model=gpt-5.4-mini] [--report]`
 * Evalúa el pipeline contra el gold set y escupe el desglose que pide el enunciado.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadEnv } from '../src/lib/env.ts';
import { installErrorHandler } from '../src/lib/cli.ts';
import { createLlm, eurPerUsd } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
import { loadGold, evaluate, type EvalReport } from '../src/eval/harness.ts';
import { allTiers } from '../src/lib/tiers.ts';

installErrorHandler();
loadEnv();
const args = process.argv.slice(2);
const routing = (args.find((a) => a.startsWith('--routing='))?.split('=')[1] ?? 'always_main') as
  'always_main' | 'always_cheap' | 'mixed';
const tiers = allTiers();
const label =
  routing === 'mixed' ? `mixto ${tiers.main.model} / ${tiers.cheap.model}`
  : routing === 'always_cheap' ? tiers.cheap.model
  : tiers.main.model;
const model = label;
const wantReport = args.includes('--report');

const llm = createLlm();
const criticRouting = (args.find((a) => a.startsWith('--critic='))?.split('=')[1] ?? 'multi_element') as
  'multi_element' | 'all' | 'off';
const out = await processMto(llm, 'data/input/MTO_tornilleria.xlsx', {
  concurrency: Number(process.env.CONCURRENCY ?? 8),
  routing,
  criticRouting,
});
// Una fila que falló en el proveedor produce una línea PROCESSING_FAILED, y todas las métricas
// bajan sin que ninguna diga por qué. Ya se leyó una vez como una regresión del prompt cuando eran
// rate limits. Si hay filas caídas, la medida NO vale y se dice antes que cualquier cifra.
const failedRows = out.analyses.filter((a) => a.error);
if (failedRows.length) {
  console.log(`\n!! MEDIDA INVÁLIDA: ${failedRows.length} de ${out.rowsIngested} filas fallaron en el proveedor`);
  for (const a of failedRows) console.log(`   fila ${a.rowRef}: ${a.error!.kind} — ${a.error!.message.slice(0, 140)}`);
  console.log('   Repite con menos concurrencia (CONCURRENCY=4) y sin otra medición en paralelo.');
}

const r = evaluate(out.lines, loadGold(), model);
const fx = eurPerUsd() || 1;
const eurPerRow = llm.stats.costUsd / fx / out.rowsIngested;

const pc = (n: number) => `${n.toFixed(1)}%`;
console.log(`\n=== ${model} ===`);
console.log(`  líneas                 gold ${r.goldLines} / sistema ${r.systemLines}`);
console.log(`  split fidelity         ${pc(r.splitFidelity.pct)}  (${r.splitFidelity.ok}/${r.splitFidelity.total} filas)`);
if (r.splitFidelity.failures.length) console.log(`    fallos: ${r.splitFidelity.failures.join(', ')}`);
console.log(`  ERROR SILENCIOSO       ${pc(r.silentErrorRate.pct)}  (${r.silentErrorRate.bad}/${r.silentErrorRate.resolved} resueltas)`);
if (r.silentErrorRate.lines.length) console.log(`    líneas: ${r.silentErrorRate.lines.join(', ')}`);
console.log(`  autonomía útil         ${pc(r.usefulAutonomy.pct)}  (${r.usefulAutonomy.ok}/${r.usefulAutonomy.total})`);
console.log(`  ruido en cola          ${pc(r.queueNoise.pct)}  (${r.queueNoise.noisy}/${r.queueNoise.review} revisiones)`);
console.log(`  acuerdo de estado      ${pc(r.statusAgreement.pct)}`);
console.log(`  motivos exactos        ${pc(r.reasonAgreement.pct)}`);
console.log(`  alucinaciones          ${out.hallucinations.length}`);
const rejected = out.analyses.flatMap((a) => a.rejectedMultiplicity.map((r) => ({ row: a.rowRef, ...r })));
console.log(`  multiplicidades rechazadas ${rejected.length}`);
for (const r of rejected) {
  // `evidence` es lo que dice la FILA, no lo que alegaba el modelo: la fila es la que decide.
  const said = r.reason === 'row_says_other'
    ? `la fila dice ${JSON.stringify(r.evidence)}`
    : 'la fila no escribe ninguna cantidad delante del nombre';
  console.log(`    fila ${r.row} ${r.element}: el modelo decía x${r.claimed}, ${said}`);
}
console.log(`  €/fila                 ${eurPerRow.toFixed(4)} €   (cache ${llm.stats.cacheHits}/${llm.stats.calls})`);
console.log(`  s de modelo / fila     ${(llm.stats.latencyMsTotal / 1000 / out.rowsIngested).toFixed(1)}s`);
console.log(`  reparto de niveles     main ${out.tierUsage.main} / cheap ${out.tierUsage.cheap}` +
  ` / sin llamada ${out.tierUsage.none} / escalados ${out.tierUsage.escalated}`);
console.log(`  crítico (${criticRouting})   ${out.critic.rowsRun}/${out.critic.rowsEligible} filas` +
  `  degradadas ${out.critic.downgraded.length}${out.critic.downgraded.length ? ': ' + out.critic.downgraded.join(', ') : ''}`);
if (out.critic.missingElements.length) {
  for (const m of out.critic.missingElements) console.log(`    fila ${m.row}: faltarían ${m.items.join(', ')}`);
}
if (out.gaps.length) {
  console.log(`\n  HUECOS DE POLÍTICA — ${out.gaps.length} en ${new Set(out.gaps.map((g) => g.rowRef)).size} filas`);
  console.log('  (no van a la cola del comprador: son decisiones que el proyecto debe)');
  for (const b of out.policyBacklog) {
    console.log(`    ${b.kind}  ${b.attribute ?? '-'}=${JSON.stringify(b.value)}  filas ${b.rows.join(',')}`);
    console.log(`      ${b.detail}`);
  }
} else {
  console.log('\n  huecos de política: ninguno');
}
console.log('  coste por nivel:');
for (const [t, v] of Object.entries(llm.byTier)) {
  if (!v.calls) continue;
  console.log(`    ${t.padEnd(7)} ${String(v.calls).padStart(3)} llamadas  ${llm.config(t as 'main').model.padEnd(30)}` +
    ` $${v.costUsd.toFixed(4)}  ${(v.latencyMs / 1000 / v.calls).toFixed(1)}s/llamada`);
}

console.log('\n  desglose por atributo (celdas CIERTAS · celdas de política):');
for (const [k, v] of Object.entries(r.perAttribute)) {
  const pol = v.totalP ? `   política ${v.okP}/${v.totalP}` : '';
  console.log(`    ${k.padEnd(9)} ${String(v.okC).padStart(2)}/${String(v.totalC).padStart(2)}  ${pc(v.pctC).padStart(6)}${pol}`);
}

const failed = r.lines.filter((l) => l.aligned && (!l.statusOk || !l.allCertainOk));
if (failed.length) {
  console.log('\n  LÍNEAS CAÍDAS:');
  for (const l of failed) {
    console.log(`    ${l.goldId ?? '?'} fila ${l.rowRef}: gold ${l.goldStatus} / sistema ${l.systemStatus}`);
    for (const c of l.cells.filter((c) => !c.ok && c.certainty === 'C')) {
      console.log(`      ${c.attribute}: esperado ${JSON.stringify(c.expected)} · obtenido ${JSON.stringify(c.got)}`);
    }
    if (l.missingReasons.length) console.log(`      motivos que faltan: ${l.missingReasons.join(', ')}`);
    if (l.extraReasons.length) console.log(`      motivos de más: ${l.extraReasons.join(', ')}`);
  }
} else {
  console.log('\n  ninguna línea caída sobre celdas ciertas.');
}

if (wantReport) {
  mkdirSync('eval/reports', { recursive: true });
  const path = `eval/reports/${model.replace(/[ /]/g, '_')}.json`;
  writeFileSync(path, JSON.stringify({ report: r, cost: llm.stats, eurPerRow } satisfies { report: EvalReport; cost: unknown; eurPerRow: number }, null, 2));
  console.log(`\n-> ${path}`);
}

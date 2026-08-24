/**
 * `pnpm run eval [-- --model=gpt-5.4-mini] [--report]`
 * Evalúa el pipeline contra el gold set y escupe el desglose que pide el enunciado.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadEnv } from '../src/lib/env.ts';
import { installErrorHandler } from '../src/lib/cli.ts';
import { createLlm, eurPerUsd, Llm } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
import { loadGold, evaluate, type EvalReport } from '../src/eval/harness.ts';
import { allTiers } from '../src/lib/tiers.ts';
import { describeOverrides, policiesFromEnv } from '../src/rules/policies.ts';
import { thresholds } from '../src/lib/confidence.ts';

installErrorHandler();
loadEnv();
const args = process.argv.slice(2);
const routing = (args.find((a) => a.startsWith('--routing='))?.split('=')[1] ?? 'always_main') as
  'always_main' | 'always_cheap' | 'mixed';
// --ablate=<stage>. 'extract' swaps the LLM reader for the deterministic baseline (SPEC-003) and
// forces the critic off: it is the number that quantifies what the model buys over tables alone.
const ablate = args.find((a) => a.startsWith('--ablate='))?.split('=')[1] ?? null;
const extractor = ablate === 'extract' ? 'baseline' : 'llm';
const tiers = allTiers();
const label =
  extractor === 'baseline' ? 'baseline determinista (sin LLM · ablación extract)'
  : routing === 'mixed' ? `mixto ${tiers.main.model} / ${tiers.cheap.model}`
  : routing === 'always_cheap' ? tiers.cheap.model
  : tiers.main.model;
const model = label;
const wantReport = args.includes('--report');
const wantSave = args.includes('--save');
const saveLabel = args.find((a) => a.startsWith('--label='))?.slice('--label='.length) ?? null;

// The baseline calls no model, so it must run without credentials: an ablation you can only run
// with an API key is one nobody runs. An empty-provider Llm reports zero cost and throws only if a
// call is ever attempted — which the baseline path never does.
const llm = extractor === 'baseline' ? new Llm(new Map(), null, tiers) : createLlm();
const criticRouting = (
  ablate === 'critic' ? 'off' : args.find((a) => a.startsWith('--critic='))?.split('=')[1] ?? 'multi_element'
) as 'multi_element' | 'all' | 'off';
if (ablate && ablate !== 'extract' && ablate !== 'critic') {
  console.log(`\n!! --ablate=${ablate} no está implementado. Disponibles: extract, critic.`);
}
const out = await processMto(llm, 'data/input/MTO_tornilleria.xlsx', {
  concurrency: Number(process.env.CONCURRENCY ?? 8),
  routing,
  criticRouting,
  extractor,
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

// Las cifras publicadas se tomaron con las políticas por defecto. Con un flag cambiado, este número
// no se puede comparar con el del 2-pager, y decirlo después de enseñarlo es tarde.
if (out.policyOverrides.length) {
  console.log(`\n!! POLÍTICAS NO POR DEFECTO: ${describeOverrides(out.policyOverrides)}`);
  console.log('   Estas cifras NO son comparables con las publicadas en docs/05-results.md.');
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
// P-9: las líneas de otra familia están FUERA de los dos denominadores de arriba, así que se
// enseñan aquí o no se enseñan en ninguna parte. Y los dos desacuerdos no valen lo mismo.
if (r.outOfScope.goldLines || r.outOfScope.falsePositives.length) {
  console.log(`  fuera de familia       ${r.outOfScope.detected}/${r.outOfScope.goldLines} detectadas` +
    ` (excluidas de autonomía y ruido)`);
  if (r.outOfScope.missed.length) {
    console.log(`    !! NO DETECTADAS (atributos inventados sobre una fila que no es tornillería): ${r.outOfScope.missed.join(', ')}`);
  }
  if (r.outOfScope.falsePositives.length) {
    console.log(`    !! tornillería descartada como otra familia: ${r.outOfScope.falsePositives.join(', ')}`);
  }
}
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
// Una fila que el crítico no pudo revisar no es una fila que aprobó. Si no se dice aquí, la medida
// del componente está contando como "sin hallazgos" filas donde el componente ni siquiera corrió.
if (out.critic.failures.length) {
  console.log(`    !! ${out.critic.failures.length} fila(s) SIN revisar por fallo del crítico — la medida del componente no las cubre:`);
  for (const f of out.critic.failures) console.log(`       fila ${f.row}: ${f.reason.slice(0, 120)}`);
}
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

// SPEC-010: `--save` persiste EXACTAMENTE el mismo informe que ya produce este script. Sin el flag,
// el comportamiento no cambia en nada — es la primera línea del contrato de la spec.
if (wantSave) {
  const { saveRun } = await import('../src/eval/history/store.ts');
  const { datasetFingerprint, policyFingerprint, vocabularyFingerprint, configurationFingerprint } =
    await import('../src/eval/history/fingerprint.ts');
  const { getGitState } = await import('../src/eval/history/git.ts');

  const { policies } = policiesFromEnv();
  const pFingerprint = policyFingerprint(policies);
  const vFingerprint = vocabularyFingerprint();
  const cFingerprint = configurationFingerprint({
    tiers, routing, criticRouting, thresholds: thresholds(), policyFingerprint: pFingerprint, vocabularyFingerprint: vFingerprint,
  });
  const git = getGitState();
  // El nivel que de verdad resuelve la mayoría de líneas es 'main' salvo que el routing fuerce cheap.
  const provider = routing === 'always_cheap' ? tiers.cheap.provider : tiers.main.provider;

  const runId = saveRun({
    label: saveLabel,
    dataset: {
      name: 'gold',
      fingerprint: datasetFingerprint('data/input/MTO_tornilleria.xlsx', 'data/gold/gold.jsonl'),
      rows: out.rowsIngested,
      goldLines: r.goldLines,
    },
    system: {
      gitCommit: git.commit,
      dirty: git.dirty,
      model,
      provider,
      routing,
      criticRouting,
      policyFingerprint: pFingerprint,
      policyOverrides: out.policyOverrides,
      configurationFingerprint: cFingerprint,
    },
    report: r,
    cost: {
      eur: llm.stats.pricesConfigured ? llm.stats.costUsd / fx : null,
      pricesConfigured: llm.stats.pricesConfigured,
    },
    latencyMs: llm.stats.latencyMsTotal,
  });
  console.log(`\n-> guardado en el histórico de evaluación: ${runId}${saveLabel ? ` (${saveLabel})` : ''}`);
  console.log('   pnpm run eval:history                            para verlo listado');
  console.log(`   pnpm run eval:compare -- <otro-run-id> ${runId}   para compararlo`);
}

/** Ejecuta ingesta + analyze sobre un MTO y vuelca el resultado. `node scripts/run-analyze.ts [xlsx]` */
import { writeFileSync } from 'node:fs';
import { loadEnv } from '../src/lib/env.ts';
import { installErrorHandler } from '../src/lib/cli.ts';
import { createLlm } from '../src/lib/llm.ts';
import { ingest } from '../src/pipeline/ingest.ts';
import { analyzeRows, ANALYZED_ATTR_KEYS } from '../src/pipeline/analyze.ts';

installErrorHandler();
loadEnv();
const file = process.argv[2] ?? 'data/input/MTO_tornilleria.xlsx';
const llm = createLlm();

const t0 = Date.now();
const { rows, skipped } = await ingest(file);
const analyses = await analyzeRows(llm, rows, {
  concurrency: Number(process.env.CONCURRENCY ?? 12),
  onRow: (a) => process.stdout.write(a.skippedLlm ? '·' : a.hallucinations.length ? '!' : '.'),
});
process.stdout.write('\n');

const totalEl = analyses.reduce((n, a) => n + a.elements.length, 0);
const hall = analyses.flatMap((a) => a.hallucinations.map((h) => ({ row: a.rowRef, ...h })));

console.log(`\nfichero        ${file}`);
console.log(`filas          ${rows.length}  (descartadas ${skipped.length})`);
console.log(`elementos      ${totalEl}`);
console.log(`fuera familia  ${analyses.filter((a) => a.outOfFamily).length}`);
console.log(`alucinaciones  ${hall.length}`);
console.log(`llamadas       ${llm.stats.calls}  (cache ${llm.stats.cacheHits})`);
console.log(`tokens         in ${llm.stats.inputTokens}  out ${llm.stats.outputTokens}`);
console.log(`coste          ${llm.stats.pricesConfigured ? '$' + llm.stats.costUsd.toFixed(4) : 'tarifas SIN CONFIGURAR'}`);
console.log(`wall clock     ${((Date.now() - t0) / 1000).toFixed(1)}s`);

console.log('\nelementos por fila:');
for (const a of analyses) {
  const tag = a.outOfFamily ? ' [FUERA DE FAMILIA]' : a.skippedLlm ? ' [sin llamada]' : '';
  console.log(`\n  fila ${a.rowRef}: ${a.elements.length} elemento(s)${tag}`);
  for (const e of a.elements) {
    const at = ANALYZED_ATTR_KEYS.map((k) => `${k[0]}=${e.attributes[k].value ?? '—'}`).join(' ');
    const m = e.multiplicityStated ? `x${e.multiplicity}` : `x${e.multiplicity}?`;
    console.log(`    ${(e.normalizedName ?? '?' + e.detectedName).padEnd(16)} ${e.role[0]} ${m.padEnd(4)} ${at}`);
  }
}
if (hall.length) {
  console.log('\nALUCINACIONES (evidencia que no existe en la fila):');
  for (const h of hall) console.log(`  fila ${h.row} ${h.attribute}: ${JSON.stringify(h.evidence)}`);
}
writeFileSync('data/output/analyses.json', JSON.stringify(analyses, null, 2));
console.log('\n-> data/output/analyses.json');

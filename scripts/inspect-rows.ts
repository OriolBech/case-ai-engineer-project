/** `pnpm run inspect -- <fila>...` — qué devolvió el modelo para filas concretas del set sintético. */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { createLlm } from '../src/lib/llm.ts';
import { ingest } from '../src/pipeline/ingest.ts';
import { analyzeRow } from '../src/pipeline/analyze.ts';

installErrorHandler();
loadEnv();
const refs = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
const file = process.argv.find((a) => a.endsWith('.xlsx')) ?? 'data/synthetic/MTO_sintetico.xlsx';
const llm = createLlm();
const { rows } = await ingest(file);

for (const ref of refs) {
  const row = rows.find((r) => r.itemRef === ref);
  if (!row) { console.log(`fila ${ref}: no existe`); continue; }
  const a = await analyzeRow(llm, row);
  console.log(`\n=== fila ${ref}`);
  console.log(`  texto: ${row.sourceText.slice(0, 150)}`);
  console.log(`  outOfFamily=${a.outOfFamily}${a.outOfFamilyReason ? ` (${a.outOfFamilyReason})` : ''} skippedLlm=${a.skippedLlm} elementos=${a.elements.length} aluc=${a.hallucinations.length}`);
  for (const e of a.elements) {
    console.log(`    ${e.role[0]} ${(e.normalizedName ?? '?' + e.detectedName).padEnd(16)} x${e.multiplicity}${e.multiplicityStated ? '' : '?'}`);
  }
  for (const h of a.hallucinations) console.log(`    ALUC ${h.attribute}: ${JSON.stringify(h.evidence)}`);
}

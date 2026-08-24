/**
 * `pnpm run corrections:kpi` — KPI propio de correcciones humanas, aparte del pipeline.
 *
 * Con la cola vacía sale 0/0, que es la respuesta honesta. Ver src/eval/history/corrections.ts.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { correctionKpi, type CorrectionKpi } from '../src/eval/history/corrections.ts';

installErrorHandler();
loadEnv();

const pct = (x: number | null): string => (x === null ? 'n/d (aún sin datos)' : `${(100 * x).toFixed(1)}%`);

function line(k: CorrectionKpi): void {
  console.log(
    `  pendientes ${String(k.pending).padStart(3)} · aprobadas ${String(k.approved).padStart(3)}` +
      ` · promovidas ${String(k.promoted).padStart(3)} · rechazadas ${String(k.rejected).padStart(3)}` +
      ` · conflictos ${String(k.conflicts).padStart(3)}`,
  );
  console.log(
    `  TASA DE CONFLICTO ${pct(k.conflictRate).padStart(18)}` +
      `   ·   ERROR SILENCIOSO PROMOVIDO ${pct(k.silentErrorRate).padStart(18)} (${k.promotedWrong}/${k.promotedVerified})`,
  );
}

const r = correctionKpi();

console.log('\n=== KPI de correcciones humanas (medido APARTE del pipeline) ===\n');
line(r);

console.log('\n  Cómo se leen estas cifras:');
console.log('   · TASA DE CONFLICTO cerca de 0% -> la casa tiene reglas escritas. Cerca del 50% ->');
console.log('     el gold único es una ficción; dos compradores normalizan distinto.');
console.log('   · ERROR SILENCIOSO PROMOVIDO es lo promovido que luego no cuadra con el gold.');
console.log('     Sólo se puede medir tras verificación ciega; 0/0 es honesto si aún no hay datos.');
if (r.pending === 0 && r.approved === 0 && r.promoted === 0 && r.conflicts === 0) {
  console.log('\n  (Cola vacía: 0/0 es correcto. Estas cifras se llenan cuando el comprador');
  console.log('   corrige en la cola y las correcciones pasan por proposeCorrection().)');
}
console.log('');

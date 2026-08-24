/**
 * `pnpm run suggestions:kpi` — el KPI PROPIO de las sugerencias de vocabulario, aparte del pipeline.
 *
 * Dos cifras y su guía de lectura. Con la cola vacía sale 0/0, que es la respuesta honesta: la
 * promesa es la forma de la medida, no un número inventado. Ver src/eval/history/suggestions.ts.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { suggestionKpi, type SuggestionKpi } from '../src/eval/history/suggestions.ts';

installErrorHandler();
loadEnv();

const pct = (x: number | null): string => (x === null ? 'n/d (aún sin datos)' : `${(100 * x).toFixed(1)}%`);

function line(label: string, k: SuggestionKpi): void {
  console.log(
    `  ${label.padEnd(10)} mostradas ${String(k.shown).padStart(3)} · pendientes ${String(k.pending).padStart(3)}` +
      ` · aceptadas ${String(k.accepted).padStart(3)} · rechazadas ${String(k.rejected).padStart(3)}`,
  );
  console.log(
    `  ${''.padEnd(10)} TASA DE ACEPTACIÓN ${pct(k.acceptanceRate).padStart(18)}` +
      `   ·   ERROR SILENCIOSO APROBADO ${pct(k.silentErrorRate).padStart(18)} (${k.acceptedWrong}/${k.acceptedVerified})`,
  );
}

const r = suggestionKpi();

console.log('\n=== KPI de sugerencias de vocabulario (medido APARTE del pipeline) ===\n');
line('GLOBAL', r);

const attrs = Object.keys(r.perAttribute);
if (attrs.length) {
  console.log('\n  por atributo:');
  for (const a of attrs) line(a, r.perAttribute[a]);
}

console.log('\n  Cómo se leen estas dos cifras:');
console.log('   · TASA DE ACEPTACIÓN cerca del 100% -> o debería haber sido una regla (resolver, no');
console.log('     sugerir), o el comprador aprueba sin mirar. Cerca del 0% -> el sugeridor es ruido.');
console.log('     El valor útil vive en medio; por eso es un KPI, no un objetivo a maximizar.');
console.log('   · ERROR SILENCIOSO APROBADO es la cifra que de verdad importa: de lo aprobado, cuánto');
console.log('     resultó mal. Sólo se puede dar porque las líneas resueltas por sugerencia viven');
console.log('     separadas de las que resuelve el sistema por sí mismo.');
if (r.shown === 0) {
  console.log('\n  (Cola vacía: 0/0 es correcto. Estas cifras se llenan con un comprador delante,');
  console.log('   no antes. Se registra con recordSuggestion(), se acepta/descarta con');
  console.log('   acceptSuggestion()/rejectSuggestion() y se valida con validateSuggestion();');
  console.log('   la verificación ciega posterior (verifySuggestion) alimenta el error silencioso.)');
}
console.log('');

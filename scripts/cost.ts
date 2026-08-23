/**
 * Coste y latencia medidos, extrapolados a los volúmenes del cliente. `node scripts/cost.ts`
 *
 * Corre sin caché para medir tokens de verdad, y con caché para medir la demo.
 */
import { loadEnv } from '../src/lib/env.ts';
import { installErrorHandler } from '../src/lib/cli.ts';
import { createLlm, eurPerUsd } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';

installErrorHandler();
loadEnv();
// La medición de coste y latencia no tiene sentido contra la caché: mediría la caché.
// Se fuerza aquí en lugar de dejarlo al entorno, porque una medida a 0 tokens parece gratis.
process.env.LLM_CACHE = 'off';
const FILE = process.argv[2] ?? 'data/input/MTO_tornilleria.xlsx';
const llm = createLlm();
const out = await processMto(llm, FILE, { concurrency: Number(process.env.CONCURRENCY ?? 12) });
const s = llm.stats;
const fx = eurPerUsd();
if (!s.pricesConfigured) throw new Error('Faltan LLM_PRICE_IN / LLM_PRICE_OUT en .env');
if (!fx) throw new Error('Falta EUR_PER_USD en .env');
if (s.inputTokens === 0) throw new Error('0 tokens medidos: la caché sigue activa');

// Volúmenes del enunciado: 20.000 filas/MTO, 15-25% tornillería, hasta 25 revisiones.
const ROWS_PER_MTO = 20_000;
const FASTENER_SHARE = 0.20;
const REVISIONS = 25;
const FASTENER_ROWS = ROWS_PER_MTO * FASTENER_SHARE;
const SECONDS_PER_ROW_MANUAL = 90;
const LOADED_EUR_PER_HOUR = 35;

const inPerRow = s.inputTokens / out.rowsIngested;
const outPerRow = s.outputTokens / out.rowsIngested;
const usdPerRow = s.costUsd / out.rowsIngested;
const eurPerRow = usdPerRow / fx;

// A escala, el prompt de sistema se sirve de caché en casi todas las filas.
const R = { in: 5.0, cachedIn: 0.5, out: 30.0 };
const atScaleUsdPerRow = (inPerRow * R.cachedIn + outPerRow * R.out) / 1e6;

const manualHours = (FASTENER_ROWS * SECONDS_PER_ROW_MANUAL) / 3600;
const manualEur = manualHours * LOADED_EUR_PER_HOUR;

const f = (n: number, d = 4) => n.toFixed(d);
console.log(`\nMEDIDO  ·  ${FILE}`);
console.log(`  filas                 ${out.rowsIngested}`);
console.log(`  líneas de salida      ${out.lines.length}`);
console.log(`  llamadas (cache)      ${s.calls} (${s.cacheHits})`);
console.log(`  tokens in / out       ${s.inputTokens} / ${s.outputTokens}`);
console.log(`  tokens por fila       ${inPerRow.toFixed(0)} in / ${outPerRow.toFixed(0)} out`);
console.log(`  tarifas configuradas  ${s.pricesConfigured ? 'sí' : 'NO'}`);
console.log(`  coste total           $${f(s.costUsd)}   ${f(s.costUsd / fx)} €`);
console.log(`  coste por fila        $${f(usdPerRow)}   ${f(eurPerRow)} €`);
console.log(`  latencia total        ${(s.latencyMsTotal / 1000).toFixed(1)}s de modelo`);

console.log(`\nEXTRAPOLADO  ·  ${FASTENER_ROWS} filas de tornillería por revisión, ${REVISIONS} revisiones`);
console.log(`  sin caché de prompt   $${f(usdPerRow * FASTENER_ROWS, 0)} / revisión    $${f(usdPerRow * FASTENER_ROWS * REVISIONS, 0)} / obra`);
console.log(`  con caché de prompt   $${f(atScaleUsdPerRow * FASTENER_ROWS, 0)} / revisión    $${f(atScaleUsdPerRow * FASTENER_ROWS * REVISIONS, 0)} / obra`);
console.log(`                        ${f((atScaleUsdPerRow * FASTENER_ROWS) / fx, 0)} € / revisión   ${f((atScaleUsdPerRow * FASTENER_ROWS * REVISIONS) / fx, 0)} € / obra`);

console.log(`\nLÍNEA BASE MANUAL  ·  ${SECONDS_PER_ROW_MANUAL}s por fila, ${LOADED_EUR_PER_HOUR} €/h cargados`);
console.log(`  horas                 ${manualHours.toFixed(0)} h / revisión`);
console.log(`  coste                 ${manualEur.toFixed(0)} € / revisión    ${(manualEur * REVISIONS).toFixed(0)} € / obra`);
console.log(`\n  el sistema es el ${((100 * (atScaleUsdPerRow * FASTENER_ROWS) / fx) / manualEur).toFixed(1)}% de la línea base manual`);

const outShare = (outPerRow * R.out) / (inPerRow * R.cachedIn + outPerRow * R.out);
console.log(`\n  reparto del coste a escala: ${(100 * outShare).toFixed(0)}% tokens de SALIDA`);
console.log('  => cachear más entrada no compra casi nada; la palanca es la salida o el modelo.');

// Qué pasaría con el modelo barato para el grueso de las filas.
const C = { cachedIn: 0.075, out: 4.5 };
const cheapUsdPerRow = (inPerRow * C.cachedIn + outPerRow * C.out) / 1e6;
console.log(`\nSI EL GRUESO VA AL MODELO BARATO (mismos tokens)`);
console.log(`  coste por fila        $${f(cheapUsdPerRow)}   ${f(cheapUsdPerRow / fx)} €`);
console.log(`  por obra              ${f((cheapUsdPerRow * FASTENER_ROWS * REVISIONS) / fx, 0)} €   ` +
            `(${(atScaleUsdPerRow / cheapUsdPerRow).toFixed(1)}x más barato)`);
console.log('  pendiente de medir: cuánto acierto se pierde. Sin ese número no es una decisión.');

// Latencia para 1000 líneas, la métrica que pide el enunciado.
const LINES_TARGET = 1000;
const linesPerRow = out.lines.length / out.rowsIngested;
const modelSecPerRow = s.latencyMsTotal / 1000 / out.rowsIngested;
const rowsFor1000 = LINES_TARGET / linesPerRow;
console.log(`\nLATENCIA PARA ${LINES_TARGET} LÍNEAS`);
console.log(`  líneas por fila       ${linesPerRow.toFixed(2)}`);
console.log(`  tiempo de modelo/fila ${modelSecPerRow.toFixed(1)}s`);
console.log(`  filas necesarias      ${rowsFor1000.toFixed(0)}`);
for (const c of [6, 16, 32, 64]) {
  const mins = (rowsFor1000 * modelSecPerRow) / c / 60;
  console.log(`  con concurrencia ${String(c).padStart(2)}    ${mins.toFixed(1)} min`);
}

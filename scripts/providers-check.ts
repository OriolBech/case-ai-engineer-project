/**
 * `npm run providers:check` — comprueba la configuración de niveles antes de gastar.
 *
 * Existe porque los tres fallos que cuestan una demo son de configuración, no de modelo: falta una
 * key, el modelo no admite salida estructurada estricta, o la tarifa no está declarada y el €/fila
 * sale a cero sin que nadie lo note.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { allTiers } from '../src/lib/tiers.ts';
import { eurPerUsd } from '../src/lib/llm.ts';

installErrorHandler();
loadEnv();

const tiers = allTiers();
const keys = { openai: !!process.env.OPENAI_API_KEY, openrouter: !!process.env.OPENROUTER_API_KEY };

// Tokens medidos por fila sobre el MTO real, para poder comparar niveles en la misma unidad.
const IN_PER_ROW = 1730;
const OUT_PER_ROW = 652;
const FASTENER_ROWS = 4000;
const REVISIONS = 25;
const fx = eurPerUsd() || 1;

let structured: Map<string, boolean> | null = null;
if (Object.values(tiers).some((t) => t.provider === 'openrouter')) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    const body = (await res.json()) as { data: { id: string; supported_parameters?: string[] }[] };
    structured = new Map(body.data.map((m) => [m.id, (m.supported_parameters ?? []).includes('structured_outputs')]));
  } catch {
    console.log('  (no se pudo consultar el catálogo de OpenRouter; se omite la comprobación de salida estructurada)\n');
  }
}

console.log('NIVELES CONFIGURADOS\n');
for (const t of Object.values(tiers)) {
  const hasKey = keys[t.provider];
  const cachedRow = (IN_PER_ROW * t.priceCachedIn + OUT_PER_ROW * t.priceOut) / 1e6;
  const perObra = (cachedRow * FASTENER_ROWS * REVISIONS) / fx;

  console.log(`${t.tier.padEnd(7)} ${t.provider}:${t.model}`);
  console.log(`        key             ${hasKey ? 'sí' : '✖ FALTA ' + (t.provider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY')}`);
  console.log(`        tarifas         ${t.priced ? `in ${t.priceIn} / out ${t.priceOut} / cache ${t.priceCachedIn} USD por 1M` : '✖ SIN DECLARAR (coste se reportará 0)'}`);
  if (t.priced) {
    console.log(`        €/fila estimado ${cachedRow / fx < 0.0001 ? (cachedRow / fx).toExponential(2) : (cachedRow / fx).toFixed(5)}   → ${perObra < 1 ? perObra.toFixed(2) : perObra.toFixed(0)} € por obra`);
  }
  if (structured && t.provider === 'openrouter') {
    const ok = structured.get(t.model);
    console.log(`        salida estricta ${ok === undefined ? '? modelo no encontrado en el catálogo' : ok ? 'sí' : '✖ el modelo NO admite structured_outputs'}`);
  }
  console.log();
}

const missing = Object.values(tiers).filter((t) => !keys[t.provider]);
if (missing.length) {
  console.log(`✖ ${missing.length} nivel(es) sin credenciales: ${missing.map((t) => t.tier).join(', ')}`);
  process.exit(1);
}
console.log('✔ configuración completa');

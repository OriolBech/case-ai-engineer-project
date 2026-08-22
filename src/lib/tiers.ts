/**
 * Tier configuration: which provider, which model, and at what price — in one place.
 *
 * Each tier is declared as a single env value, `provider:model:priceIn:priceOut[:priceCachedIn]`:
 *
 *   LLM_MAIN=openai:gpt-5.5:5.00:30.00:0.50
 *   LLM_CHEAP=openai:gpt-5.4:2.50:15.00:0.25
 *   LLM_CRITIC=openrouter:openai/gpt-oss-120b:0.03:0.17
 *
 * Prices live NEXT TO the model on purpose. Keeping them in separate variables is how a €/row
 * figure silently becomes wrong: someone swaps the model and the rate stays. Here they cannot
 * drift apart, and switching provider for one stage is one line.
 */

export type Tier = 'main' | 'cheap' | 'critic';
export type ProviderName = 'openai' | 'openrouter';

export interface TierConfig {
  tier: Tier;
  provider: ProviderName;
  model: string;
  /** USD per 1M tokens. */
  priceIn: number;
  priceOut: number;
  priceCachedIn: number;
  /** false when prices were not declared: cost is then reported as 0 and flagged, never guessed. */
  priced: boolean;
}

const ENV_KEY: Record<Tier, string> = {
  main: 'LLM_MAIN',
  cheap: 'LLM_CHEAP',
  critic: 'LLM_CRITIC',
};

/**
 * Parses one tier line.
 *
 * Prices are read from the RIGHT, not by field position: OpenRouter model ids contain colons
 * (`z-ai/glm-5.2:free`), and splitting left to right turned `:free` into a price. Those are exactly
 * the models you reach for to measure without spending, so getting this wrong breaks the cheap
 * path first.
 */
function parse(tier: Tier, raw: string): TierConfig {
  const parts = raw.split(':');
  if (parts.length < 2) {
    throw new Error(
      `${ENV_KEY[tier]} mal formado: "${raw}". Formato: provider:model:priceIn:priceOut[:priceCachedIn]`,
    );
  }
  const provider = parts[0];
  const rest = parts.slice(1);
  // Trailing numeric fields are prices; up to three, and never so many that the model disappears.
  const isNum = (v: string): boolean => v.trim() !== '' && Number.isFinite(Number(v));
  let nPrices = 0;
  while (nPrices < 3 && rest.length - nPrices > 1 && isNum(rest[rest.length - 1 - nPrices])) nPrices++;
  const model = rest.slice(0, rest.length - nPrices).join(':');
  const [pin, pout, pcached] = rest.slice(rest.length - nPrices);
  if (provider !== 'openai' && provider !== 'openrouter') {
    throw new Error(`${ENV_KEY[tier]}: proveedor "${provider}" desconocido. Usa openai u openrouter.`);
  }
  // Absent is not zero. `Number('')` is 0 and finite, so an omitted price silently became a free
  // model — which is exactly the kind of quiet wrong number this whole file exists to prevent.
  const num = (v: string | undefined): number | null => {
    if (v === undefined || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const priceIn = num(pin);
  const priceOut = num(pout);
  const priced = priceIn !== null && priceOut !== null;
  const cached = num(pcached);
  return {
    tier,
    provider,
    model,
    priceIn: priceIn ?? 0,
    priceOut: priceOut ?? 0,
    // Providers charge a cache read at a fraction of input; both current ones use 10%.
    priceCachedIn: cached ?? (priceIn !== null ? priceIn * 0.1 : 0),
    priced,
  };
}

export function tierConfig(tier: Tier, env: NodeJS.ProcessEnv = process.env): TierConfig {
  const raw = env[ENV_KEY[tier]];
  if (raw) return parse(tier, raw);
  // The critic falls back to the cheap tier: it is a verification task, not the main read.
  if (tier === 'critic') return { ...tierConfig('cheap', env), tier: 'critic' };
  throw new Error(`Falta ${ENV_KEY[tier]} en .env. Ver .env.example.`);
}

export function allTiers(env: NodeJS.ProcessEnv = process.env): Record<Tier, TierConfig> {
  return { main: tierConfig('main', env), cheap: tierConfig('cheap', env), critic: tierConfig('critic', env) };
}

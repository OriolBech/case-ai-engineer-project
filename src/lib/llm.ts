/**
 * The single door to any model. See docs/decisions/ADR-003-llm-provider.md and ADR-004.
 *
 * Nothing in src/pipeline imports a provider SDK. Switching provider is an env var, and the
 * day-4 comparison in the 2-pager is a re-run, not a rewrite.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type ProviderName, type Tier, type TierConfig, allTiers } from './tiers.ts';

/**
 * Per-request deadline.
 *
 * Node's fetch has NO default timeout, so a hung connection blocks forever. It happened: a model
 * sweep sat on one provider for seven minutes with nothing to show and no way to know whether it
 * was slow or dead. In a 60-minute demo that is the worst possible failure — indistinguishable from
 * a crash, but without the error message.
 */
const DEFAULT_TIMEOUT_MS = 120_000;

function timeoutMs(): number {
  const v = Number(process.env.LLM_TIMEOUT_MS ?? '');
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

/** Wraps fetch with a deadline and turns an abort into a retryable error, not a raw DOMException. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ms = timeoutMs();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      // 504-shaped: retryable, because a timeout can be transient provider load.
      throw new LlmError(504, `Sin respuesta del proveedor en ${ms / 1000}s`);
    }
    throw e;
  }
}

export interface LlmRequest {
  /** Stable across rows. Kept first so provider-side prefix caching can hit. */
  system: string;
  user: string;
  /** JSON Schema. The provider must enforce it; we never parse prose. */
  schema: Record<string, unknown>;
  schemaName: string;
  /** Which configured tier to use. See src/lib/tiers.ts. */
  tier?: Tier;
  maxTokens?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  latencyMs: number;
  model: string;
  cacheHit: boolean;
}

export interface LlmResponse<T> {
  data: T;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly name: string;
  complete<T>(req: LlmRequest, cfg: TierConfig): Promise<LlmResponse<T>>;
}

/**
 * A provider failure, classified so callers can tell apart what to retry, what to report to the
 * user, and what to give up on.
 *
 * Written after a benchmark run died mid-way with a raw stack trace because the account ran out of
 * credit. In a 60-minute demo that is the difference between "one row could not be processed" and
 * a terminal full of red.
 */
export class LlmError extends Error {
  readonly status: number;
  readonly kind: 'quota' | 'auth' | 'rate_limit' | 'timeout' | 'server' | 'request';
  readonly retryable: boolean;

  constructor(status: number, body: string) {
    const quota = /insufficient_quota|credit_balance_exhausted|no credits remaining/i.test(body);
    const kind: LlmError['kind'] =
      quota ? 'quota'
      : status === 401 || status === 403 ? 'auth'
      : status === 429 ? 'rate_limit'
      : status === 504 ? 'timeout'
      : status >= 500 ? 'server'
      : 'request';
    const human =
      kind === 'quota' ? 'Sin crédito en la cuenta del proveedor. Añadir saldo y reintentar.'
      : kind === 'auth' ? 'La API key no es válida o no tiene permisos. Revisar OPENAI_API_KEY en .env.'
      : kind === 'rate_limit' ? 'Límite de peticiones alcanzado. Bajar CONCURRENCY o esperar.'
      : kind === 'timeout' ? 'El proveedor no respondió en el plazo. Ajustable con LLM_TIMEOUT_MS.'
      : kind === 'server' ? `El proveedor devolvió ${status}.`
      : `Petición rechazada (${status}).`;
    super(`${human}\n  ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
    this.name = 'LlmError';
    this.status = status;
    this.kind = kind;
    // Quota and auth do not get better by asking again.
    this.retryable = kind === 'rate_limit' || kind === 'server' || kind === 'timeout';
  }
}

// ---------------------------------------------------------------------------
// Disk cache (ADR-004)
// ---------------------------------------------------------------------------

/**
 * Caches ONLY the model call — never the normalizer or the validator.
 *
 * That boundary is deliberate: if the cache covered the whole pipeline, flipping a POLICY_* flag
 * during the challenge would have no visible effect, and that live demonstration is the point.
 * Deterministic stages are cheap; re-running them costs nothing.
 */
class DiskCache {
  // Node's strip-only TypeScript mode does not support parameter properties, so fields are
  // declared explicitly throughout this codebase. See README § Convenciones.
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  private path(key: string): string { return join(this.dir, `${key}.json`); }

  key(provider: string, model: string, req: LlmRequest): string {
    return createHash('sha256')
      .update(JSON.stringify([provider, model, req.system, req.user, req.schema, req.maxTokens ?? 0]))
      .digest('hex')
      .slice(0, 32);
  }

  get<T>(key: string): { data: T; usage: LlmUsage } | null {
    const p = this.path(key);
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
  }

  set(key: string, value: unknown): void {
    writeFileSync(this.path(key), JSON.stringify(value, null, 2), 'utf8');
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------


class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly apiKey: string;

  constructor(apiKey: string) { this.apiKey = apiKey; }

  async complete<T>(req: LlmRequest, cfg: TierConfig): Promise<LlmResponse<T>> {
    const model = cfg.model;
    const started = Date.now();

    const res = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        max_output_tokens: req.maxTokens ?? 4096,
        text: {
          format: {
            type: 'json_schema',
            name: req.schemaName,
            strict: true,
            schema: req.schema,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 600);
      throw new LlmError(res.status, body);
    }
    const body = (await res.json()) as {
      output?: { type: string; content?: { type: string; text?: string }[] }[];
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
      incomplete_details?: { reason?: string };
    };

    if (body.incomplete_details?.reason) {
      throw new Error(`OpenAI respuesta incompleta: ${body.incomplete_details.reason}`);
    }

    const text =
      body.output_text ??
      body.output
        ?.filter((o) => o.type === 'message')
        .flatMap((o) => o.content ?? [])
        .map((c) => c.text ?? '')
        .join('') ??
      '';
    if (!text.trim()) throw new Error('OpenAI devolvió una respuesta vacía');

    const inTok = body.usage?.input_tokens ?? 0;
    const outTok = body.usage?.output_tokens ?? 0;
    const cached = body.usage?.input_tokens_details?.cached_tokens ?? 0;
    return {
      data: JSON.parse(text) as T,
      usage: usage(cfg, inTok, outTok, cached, started),
    };
  }
}

/**
 * OpenRouter. One HTTP surface for a few hundred models, including open-weight ones, which is what
 * makes the cost question go away: output tokens are 96% of the bill, and an open model bills
 * output at two orders of magnitude less. That does not make it the right choice — it makes the
 * choice depend only on accuracy, which is the honest way to decide it.
 *
 * OpenAI-compatible /chat/completions, so only the envelope differs.
 */
class OpenRouterProvider implements LlmProvider {
  readonly name = 'openrouter';
  private readonly apiKey: string;

  constructor(apiKey: string) { this.apiKey = apiKey; }

  async complete<T>(req: LlmRequest, cfg: TierConfig): Promise<LlmResponse<T>> {
    const started = Date.now();
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        // Identifies the caller in OpenRouter's dashboard; harmless and useful for cost attribution.
        'X-Title': 'MTO tornilleria',
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        max_tokens: req.maxTokens ?? 4096,
        // Only models advertising `structured_outputs` honour strict mode. Picking one that does
        // is a configuration decision, checked by `npm run providers:check`.
        response_format: {
          type: 'json_schema',
          json_schema: { name: req.schemaName, strict: true, schema: req.schema },
        },
      }),
    });

    if (!res.ok) throw new LlmError(res.status, (await res.text()).slice(0, 600));

    const body = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
      error?: { message?: string };
    };
    if (body.error) throw new LlmError(500, JSON.stringify(body.error));

    const choice = body.choices?.[0];
    // A truncated response would parse as invalid JSON and surface as a confusing syntax error.
    if (choice?.finish_reason === 'length') throw new Error('OpenRouter: respuesta truncada (max_tokens)');
    const text = choice?.message?.content ?? '';
    if (!text.trim()) throw new Error('OpenRouter devolvió una respuesta vacía');

    return {
      data: JSON.parse(text) as T,
      usage: usage(
        cfg,
        body.usage?.prompt_tokens ?? 0,
        body.usage?.completion_tokens ?? 0,
        body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        started,
      ),
    };
  }
}

function usage(cfg: TierConfig, inTok: number, outTok: number, cached: number, started: number): LlmUsage {
  return {
    inputTokens: inTok,
    outputTokens: outTok,
    cachedInputTokens: cached,
    costUsd: ((inTok - cached) * cfg.priceIn + cached * cfg.priceCachedIn + outTok * cfg.priceOut) / 1_000_000,
    latencyMs: Date.now() - started,
    model: cfg.model,
    cacheHit: false,
  };
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** EUR per USD, for the €/row the brief asks for. Configured with its date, like the rates. */
export const eurPerUsd = (): number => Number(process.env.EUR_PER_USD ?? '') || 0;

export interface LlmStats {
  calls: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMsTotal: number;
  /** false when LLM_PRICE_IN/OUT are unset: costUsd is then 0 and must not be reported as real. */
  pricesConfigured: boolean;
}

export class Llm {
  readonly stats: LlmStats;
  /** Per-tier accounting: which stage spends the money, not just the total. */
  readonly byTier: Record<Tier, { calls: number; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number }>;

  private readonly providers: Map<ProviderName, LlmProvider>;
  private readonly cache: DiskCache | null;
  private readonly tiers: Record<Tier, TierConfig>;

  constructor(providers: Map<ProviderName, LlmProvider>, cache: DiskCache | null, tiers: Record<Tier, TierConfig>) {
    this.providers = providers;
    this.cache = cache;
    this.tiers = tiers;
    this.stats = {
      calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMsTotal: 0,
      pricesConfigured: Object.values(tiers).every((t) => t.priced),
    };
    const zero = () => ({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 });
    this.byTier = { main: zero(), cheap: zero(), critic: zero() };
  }

  config(tier: Tier): TierConfig { return this.tiers[tier]; }

  /** Retries only what can improve: rate limits and 5xx. Quota and auth fail immediately. */
  private async withRetries<T>(req: LlmRequest, attempts = 3): Promise<LlmResponse<T>> {
    const cfg = this.tiers[req.tier ?? 'main'];
    const provider = this.providers.get(cfg.provider);
    if (!provider) {
      throw new Error(
        `El nivel '${cfg.tier}' usa ${cfg.provider} (${cfg.model}) y falta su API key. ` +
          `Define ${cfg.provider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY'} en .env, ` +
          'o apunta ese nivel a otro proveedor. Comprueba con: npm run providers:check',
      );
    }
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await provider.complete<T>(req, cfg);
      } catch (e) {
        last = e;
        if (!(e instanceof LlmError) || !e.retryable || i === attempts - 1) throw e;
        // A timeout already cost the full deadline; do not add a long backoff on top of it.
        const backoff = e.kind === 'timeout' ? 500 : 1000 * 2 ** i;
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw last;
  }

  async complete<T>(req: LlmRequest): Promise<LlmResponse<T>> {
    const tier = req.tier ?? 'main';
    const cfg = this.tiers[tier];
    const key = this.cache?.key(cfg.provider, cfg.model, req);

    if (key) {
      const hit = this.cache!.get<T>(key);
      if (hit) {
        this.stats.calls++;
        this.stats.cacheHits++;
        return { data: hit.data, usage: { ...hit.usage, cacheHit: true, latencyMs: 0 } };
      }
    }

    const out = await this.withRetries<T>(req);
    if (key) this.cache!.set(key, out);

    this.stats.calls++;
    this.stats.inputTokens += out.usage.inputTokens;
    this.stats.outputTokens += out.usage.outputTokens;
    this.stats.costUsd += out.usage.costUsd;
    this.stats.latencyMsTotal += out.usage.latencyMs;

    const t = this.byTier[tier];
    t.calls++;
    t.inputTokens += out.usage.inputTokens;
    t.outputTokens += out.usage.outputTokens;
    t.costUsd += out.usage.costUsd;
    t.latencyMs += out.usage.latencyMs;
    return out;
  }
}

export function createLlm(env: NodeJS.ProcessEnv = process.env): Llm {
  const cache =
    (env.LLM_CACHE ?? 'on') === 'on'
      ? new DiskCache(env.LLM_CACHE_DIR ?? 'data/output/.llm-cache')
      : null;

  const tiers = allTiers(env);

  // Registered lazily: a tier that is configured but never used must not require a key. Turning the
  // critic off should not demand credentials for the critic's provider. The missing-key error
  // arrives when a call actually needs it, and `npm run providers:check` validates all of them up
  // front for when you do want that check.
  const providers = new Map<ProviderName, LlmProvider>();
  if (env.OPENAI_API_KEY) providers.set('openai', new OpenAiProvider(env.OPENAI_API_KEY));
  if (env.OPENROUTER_API_KEY) providers.set('openrouter', new OpenRouterProvider(env.OPENROUTER_API_KEY));
  if (providers.size === 0) {
    throw new Error('Sin credenciales: define OPENAI_API_KEY y/o OPENROUTER_API_KEY. Ver .env.example.');
  }
  return new Llm(providers, cache, tiers);
}

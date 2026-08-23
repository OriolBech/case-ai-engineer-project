/**
 * OpenRouter latency options: provider routing and reasoning effort.
 *
 * The same open model is served at ~50 tok/s by one provider and ~2.000 tok/s by another, which
 * is where the 9x latency variance in docs/11-benchmarks.md comes from. These options are how the
 * pipeline stops depending on OpenRouter's default route — and because they can change the output,
 * they are part of the disk-cache key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterProvider } from '../llm.ts';
import type { TierConfig } from '../tiers.ts';

const cfg: TierConfig = {
  tier: 'main', provider: 'openrouter', model: 'openai/gpt-oss-120b',
  priceIn: 0.03, priceOut: 0.17, priceCachedIn: 0.003, priced: true,
};

const req = { system: 's', user: 'u', schema: {}, schemaName: 'n' };

function withMockFetch(captured: { body?: Record<string, unknown> }, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init: { body?: string }) => {
    captured.body = JSON.parse(init.body ?? '{}') as Record<string, unknown>;
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return fn().finally(() => { globalThis.fetch = original; });
}

test('sin opciones no se envía ni provider ni reasoning (comportamiento anterior intacto)', async () => {
  const p = new OpenRouterProvider('key');
  assert.equal(p.cacheKeyExtra(), '');
  const captured: { body?: Record<string, unknown> } = {};
  await withMockFetch(captured, async () => {
    await p.complete(req, cfg);
  });
  assert.equal(captured.body!.provider, undefined);
  assert.equal(captured.body!.reasoning, undefined);
});

test('sort=throughput y effort=low viajan en el body y entran en la clave de caché', async () => {
  const p = new OpenRouterProvider('key', { providerSort: 'throughput', reasoningEffort: 'low' });
  assert.notEqual(p.cacheKeyExtra(), '', 'una opción que puede cambiar la salida invalida la caché');
  const captured: { body?: Record<string, unknown> } = {};
  await withMockFetch(captured, async () => {
    await p.complete(req, cfg);
  });
  assert.deepEqual(captured.body!.provider, { sort: 'throughput' });
  assert.deepEqual(captured.body!.reasoning, { effort: 'low' });
});

test('una lista de proveedores tiene prioridad sobre el sort', async () => {
  const p = new OpenRouterProvider('key', { providerSort: 'price', providerOrder: 'Cerebras, Groq' });
  const captured: { body?: Record<string, unknown> } = {};
  await withMockFetch(captured, async () => {
    await p.complete(req, cfg);
  });
  assert.deepEqual(captured.body!.provider, { order: ['Cerebras', 'Groq'] });
});

test('el crítico tiene su propio dial, y sin override hereda el global', async () => {
  const p = new OpenRouterProvider('key', { reasoningEffort: 'low', reasoningEffortCritic: 'high' });
  const captured: { bodies: Record<string, unknown>[] } = { bodies: [] };
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init: { body?: string }) => {
    captured.bodies.push(JSON.parse(init.body ?? '{}') as Record<string, unknown>);
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    await p.complete({ ...req, tier: 'critic' }, cfg);
    await p.complete({ ...req, tier: 'main' }, cfg);
  } finally {
    globalThis.fetch = original;
  }
  assert.deepEqual(captured.bodies[0].reasoning, { effort: 'high' });
  assert.deepEqual(captured.bodies[1].reasoning, { effort: 'low' });
  // Two tiers with different effort must not share cache entries.
  assert.notEqual(p.cacheKeyExtra('critic'), p.cacheKeyExtra('main'));

  const q = new OpenRouterProvider('key', { reasoningEffort: 'low' });
  assert.equal(q.cacheKeyExtra('critic'), q.cacheKeyExtra('main'), 'sin override, el crítico hereda');
});

test('valores inválidos se rechazan al configurar, no en mitad de una ejecución', () => {
  assert.throws(() => new OpenRouterProvider('key', { providerSort: 'rapido' }), /OPENROUTER_PROVIDER_SORT/);
  assert.throws(() => new OpenRouterProvider('key', { reasoningEffort: 'bajo' }), /LLM_REASONING_EFFORT/);
  assert.throws(() => new OpenRouterProvider('key', { reasoningEffortCritic: 'max' }), /LLM_REASONING_EFFORT_CRITIC/);
});

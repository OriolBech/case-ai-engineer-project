/**
 * A strict JSON Schema is a request to the provider, not a promise from it.
 *
 * Row 6 of the MTO came back from an open-weight model with no `elements` field at all. The pipeline
 * tolerates a malformed response rather than crashing, so it read that as "this row has no
 * materials" — and cached it, which made the row stay broken across every later run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Llm, LlmError, type LlmProvider, type LlmRequest } from '../llm.ts';
import { allTiers } from '../tiers.ts';

const tiers = allTiers({ LLM_MAIN: 'openai:m:1:1', LLM_CHEAP: 'openai:m:1:1', LLM_CRITIC: 'openai:m:1:1' } as unknown as NodeJS.ProcessEnv);

function stubProvider(responses: unknown[]): { provider: LlmProvider; calls: () => number } {
  let i = 0;
  return {
    calls: () => i,
    provider: {
      name: 'openai',
      complete: async <T>() => {
        const data = responses[Math.min(i, responses.length - 1)];
        i++;
        return {
          data: data as T,
          usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, costUsd: 0, latencyMs: 1, model: 'm', cacheHit: false },
        };
      },
    },
  };
}

const req = (validate?: (d: unknown) => boolean): LlmRequest => ({
  system: 's', user: 'u', schema: {}, schemaName: 'n', tier: 'main', validate,
});

test('una respuesta que ignora el esquema se reintenta', async () => {
  const { provider, calls } = stubProvider([{ nope: true }, { elements: [] }]);
  const llm = new Llm(new Map([['openai', provider]]), null, tiers);
  const out = await llm.complete<{ elements: unknown[] }>(req((d) => Array.isArray((d as { elements?: unknown }).elements)));
  assert.deepEqual(out.data.elements, []);
  assert.equal(calls(), 2, 'la primera respuesta se descarta y se vuelve a pedir');
});

test('si insiste en no cumplirlo, falla en lugar de inventar una respuesta vacía', async () => {
  const { provider } = stubProvider([{ nope: true }]);
  const llm = new Llm(new Map([['openai', provider]]), null, tiers);
  await assert.rejects(
    () => llm.complete(req((d) => Array.isArray((d as { elements?: unknown }).elements))),
    (e: unknown) => e instanceof LlmError,
  );
});

test('una lista vacía SÍ es una respuesta válida', async () => {
  const { provider, calls } = stubProvider([{ elements: [] }]);
  const llm = new Llm(new Map([['openai', provider]]), null, tiers);
  await llm.complete(req((d) => Array.isArray((d as { elements?: unknown }).elements)));
  assert.equal(calls(), 1, 'sin elementos no es lo mismo que sin respuesta');
});

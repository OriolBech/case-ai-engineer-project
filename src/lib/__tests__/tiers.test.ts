import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { tierConfig, allTiers } from '../tiers.ts';

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe('tiers', () => {
  test('parsea provider:model:in:out:cached', () => {
    const t = tierConfig('main', env({ LLM_MAIN: 'openai:gpt-5.5:5.00:30.00:0.50' }));
    assert.equal(t.provider, 'openai');
    assert.equal(t.model, 'gpt-5.5');
    assert.deepEqual([t.priceIn, t.priceOut, t.priceCachedIn], [5, 30, 0.5]);
    assert.equal(t.priced, true);
  });

  test('el precio de caché omitido cae al 10% de la entrada, no a cero', () => {
    const t = tierConfig('critic', env({ LLM_CRITIC: 'openrouter:openai/gpt-oss-120b:0.03:0.17' }));
    assert.equal(t.priceCachedIn, 0.003);
  });

  test('un modelo con : en el nombre (:free) no se parte', () => {
    const t = tierConfig('cheap', env({ LLM_CHEAP: 'openrouter:z-ai/glm-5.2:free:0:0' }));
    assert.equal(t.provider, 'openrouter');
    assert.equal(t.model, 'z-ai/glm-5.2:free', 'el :free es parte del id, no un precio');
    assert.deepEqual([t.priceIn, t.priceOut], [0, 0]);
    assert.equal(t.priced, true, 'gratis es un precio declarado, no un precio ausente');
  });

  test('modelo con : y sin precios', () => {
    const t = tierConfig('cheap', env({ LLM_CHEAP: 'openrouter:openai/gpt-oss-20b:free' }));
    assert.equal(t.model, 'openai/gpt-oss-20b:free');
    assert.equal(t.priced, false);
  });

  test('sin tarifas declaradas se marca priced=false, y no se inventan', () => {
    const t = tierConfig('main', env({ LLM_MAIN: 'openai:gpt-5.5' }));
    assert.equal(t.priced, false);
    assert.deepEqual([t.priceIn, t.priceOut], [0, 0]);
  });

  test('el crítico hereda del nivel cheap si no se declara', () => {
    const t = allTiers(env({ LLM_MAIN: 'openai:a:1:2', LLM_CHEAP: 'openai:b:3:4' }));
    assert.equal(t.critic.model, 'b');
    assert.equal(t.critic.tier, 'critic');
  });

  test('proveedor desconocido y formato roto fallan explícitamente', () => {
    assert.throws(() => tierConfig('main', env({ LLM_MAIN: 'cohere:x:1:2' })), /desconocido/);
    assert.throws(() => tierConfig('main', env({ LLM_MAIN: 'openai' })), /mal formado/);
    assert.throws(() => tierConfig('main', env({})), /Falta LLM_MAIN/);
  });
});

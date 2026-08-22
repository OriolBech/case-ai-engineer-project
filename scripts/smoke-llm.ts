/** Verifica contra la API real que la interfaz de proveedor funciona. `node scripts/smoke-llm.ts` */
import { loadEnv } from '../src/lib/env.ts';
import { createLlm } from '../src/lib/llm.ts';

loadEnv();
const llm = createLlm();

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['elements'],
  properties: {
    elements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'evidence'],
        properties: {
          name: { type: 'string', enum: ['TORNILLO', 'TUERCA', 'ARANDELA', 'VARILLA ROSCADA', 'ESPARRAGO'] },
          evidence: { type: 'string' },
        },
      },
    },
  },
};

const tier = (process.argv[2] ?? 'main') as 'main' | 'cheap' | 'critic';
console.log(`tier=${tier}  ${llm.config(tier).provider}:${llm.config(tier).model}`);
const res = await llm.complete<{ elements: { name: string; evidence: string }[] }>({
  tier,
  system: 'Devuelve los elementos de tornillería mencionados, con el fragmento literal que lo justifica.',
  user: 'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436',
  schema,
  schemaName: 'elements',
});

console.log(JSON.stringify(res.data, null, 2));
console.log('usage:', res.usage);
console.log('stats:', llm.stats);

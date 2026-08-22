import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { needsCritic, criticiseRow } from '../critic.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow, OutputLine } from '../types.ts';
import type { Llm } from '../../lib/llm.ts';

const row: MtoRow = {
  itemRef: '1', sourceText: 'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H',
  cellOffsets: {}, quantity: 40, unit: 'uds', sheet: 'MTO', rowNumber: 5,
};

const analysis = (n: number, extra: Partial<Analysis> = {}): Analysis => ({
  rowRef: '1', outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], skippedLlm: false, tier: 'main', escalated: false, error: null, ...extra,
});

const attr = { raw: null, normalized: null, provenance: 'absent' as const, span: null, rule: null };
const line = (id: string, status: OutputLine['status']): OutputLine => ({
  id, rowRef: '1', status,
  attributes: { name: attr, material: attr, quality: attr, measure: attr, length: attr, standard: attr, finish: attr },
  quantity: 40, quantityProvenance: 'extracted', reasons: [], confidence: 0.9, policiesApplied: [],
});

/** Stub provider: returns whatever verdicts the test wants, with no network and no cost. */
function stubLlm(verdicts: unknown, opts: { throws?: boolean } = {}): Llm {
  let calls = 0;
  return {
    complete: async () => {
      calls++;
      if (opts.throws) throw new Error('proveedor caído');
      return { data: verdicts, usage: {} };
    },
    get callCount() { return calls; },
  } as unknown as Llm;
}

describe('needsCritic · enrutado por riesgo de descomposición', () => {
  test('una fila de un solo elemento no tiene dónde equivocarse: no se llama', () => {
    assert.equal(needsCritic(analysis(1), 'multi_element'), false);
  });
  test('una fila multi-elemento sí', () => {
    assert.equal(needsCritic(analysis(3), 'multi_element'), true);
  });
  test('una alucinación detectada fuerza revisión aunque sea de un elemento', () => {
    const a = analysis(1, { hallucinations: [{ element: 'TUERCA', attribute: 'quality', evidence: 'X' }] });
    assert.equal(needsCritic(a, 'multi_element'), true);
  });
  test('no se gasta en filas fuera de familia, vacías o fallidas', () => {
    assert.equal(needsCritic(analysis(3, { outOfFamily: true }), 'multi_element'), false);
    assert.equal(needsCritic(analysis(0, { skippedLlm: true }), 'multi_element'), false);
    assert.equal(needsCritic(analysis(3, { error: { kind: 'quota', message: 'x' } }), 'multi_element'), false);
  });
  test('off nunca, all siempre que haya elementos', () => {
    assert.equal(needsCritic(analysis(3), 'off'), false);
    assert.equal(needsCritic(analysis(1), 'all'), true);
  });
});

describe('criticiseRow · SÓLO puede degradar', () => {
  test('degrada una resuelta con la que no está de acuerdo', async () => {
    const llm = stubLlm({
      missingElements: [],
      verdicts: [{ lineId: '1.2', agrees: false, issue: 'WRONG_ATTRIBUTION', attribute: 'quality', explanation: 'ASTM F436 es una norma, no una calidad' }],
    });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'RESUELTA'), line('1.2', 'RESUELTA')]);
    assert.deepEqual(r.downgraded, ['1.2']);
    assert.equal(r.lines[1].status, 'REVISION_MANUAL');
    assert.equal(r.lines[1].reasons[0].code, 'CRITIC_DISAGREES');
    assert.match(r.lines[1].reasons[0].message, /norma, no una calidad/);
    assert.equal(r.lines[1].reasons[0].attribute, 'quality');
    assert.equal(r.lines[0].status, 'RESUELTA', 'la otra línea no se toca');
  });

  test('NUNCA promueve una revisión a resuelta, aunque esté de acuerdo', async () => {
    const llm = stubLlm({ missingElements: [], verdicts: [{ lineId: '1.1', agrees: true, issue: null, attribute: null, explanation: null }] });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'REVISION_MANUAL')]);
    assert.equal(r.lines[0].status, 'REVISION_MANUAL');
    assert.deepEqual(r.downgraded, []);
  });

  test('discrepar de una línea ya en revisión no la duplica de motivos', async () => {
    const llm = stubLlm({ missingElements: [], verdicts: [{ lineId: '1.1', agrees: false, issue: 'OTHER', attribute: null, explanation: 'x' }] });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'REVISION_MANUAL')]);
    assert.equal(r.lines[0].reasons.length, 0, 'no añade CRITIC_DISAGREES a algo ya en revisión');
  });

  test('si el crítico falla, el veredicto del motor de reglas se mantiene', async () => {
    const llm = stubLlm(null, { throws: true });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'RESUELTA')]);
    assert.equal(r.ran, false);
    assert.equal(r.lines[0].status, 'RESUELTA', 'una red de seguridad que falla no rompe la ejecución');
  });

  test('un veredicto sobre un lineId inexistente se ignora', async () => {
    const llm = stubLlm({ missingElements: [], verdicts: [{ lineId: 'NOPE', agrees: false, issue: 'OTHER', attribute: null, explanation: 'x' }] });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'RESUELTA')]);
    assert.equal(r.lines[0].status, 'RESUELTA');
  });

  test('reporta elementos que faltan a nivel de fila', async () => {
    const llm = stubLlm({ missingElements: ['ARANDELA'], verdicts: [] });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'RESUELTA')]);
    assert.deepEqual(r.missingElements, ['ARANDELA']);
  });

  test('no llama al modelo cuando la fila no lo necesita', async () => {
    const llm = stubLlm({ missingElements: [], verdicts: [] });
    await criticiseRow(llm, row, analysis(1), [line('1.1', 'RESUELTA')]);
    assert.equal((llm as unknown as { callCount: number }).callCount, 0);
  });
});

describe('criticiseRow · robustez ante respuestas mal formadas', () => {
  test('sin campo verdicts no rompe: se interpreta como "sin opinión"', async () => {
    // Ocurrió de verdad con un modelo abierto: .map sobre undefined tumbó la ejecución entera.
    const llm = stubLlm({ missingElements: [] });
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'RESUELTA')]);
    assert.equal(r.lines[0].status, 'RESUELTA');
    assert.deepEqual(r.downgraded, []);
  });

  test('respuesta vacía, veredictos basura y missingElements no-array tampoco rompen', async () => {
    for (const bad of [{}, null, { verdicts: 'x', missingElements: 3 }, { verdicts: [null, { agrees: false }] }]) {
      const r = await criticiseRow(stubLlm(bad), row, analysis(2), [line('1.1', 'RESUELTA')]);
      assert.equal(r.lines[0].status, 'RESUELTA');
      assert.deepEqual(r.missingElements, []);
    }
  });
});

describe('normalize · el nombre lo decide la tabla, no el modelo', () => {
  test('STUD BOLT es ESPARRAGO aunque el modelo diga VARILLA ROSCADA', async () => {
    // Caso real: gpt-oss-120b clasificó así las filas 1 y 12, sus dos únicos fallos del MTO.
    const { normalizeElement } = await import('../normalize.ts');
    const el = {
      detectedName: 'STUD BOLT', normalizedName: 'VARILLA ROSCADA', role: 'principal' as const,
      span: null, multiplicity: 1, multiplicityStated: false,
      attributes: Object.fromEntries(
        ['material', 'quality', 'measure', 'length', 'standard', 'finish']
          .map((k) => [k, { value: null, span: null, hallucinated: false }]),
      ),
    };
    const n = normalizeElement(el as never);
    assert.equal(n.name.normalized, 'ESPARRAGO');
    assert.match(n.name.rule!, /^name:table:/);
  });

  test('cuando la tabla no puede decidir, manda el modelo', async () => {
    const { normalizeElement } = await import('../normalize.ts');
    const el = {
      detectedName: 'FIJACION ESPECIAL', normalizedName: 'TORNILLO', role: 'principal' as const,
      span: null, multiplicity: 1, multiplicityStated: false,
      attributes: Object.fromEntries(
        ['material', 'quality', 'measure', 'length', 'standard', 'finish']
          .map((k) => [k, { value: null, span: null, hallucinated: false }]),
      ),
    };
    const n = normalizeElement(el as never);
    assert.equal(n.name.normalized, 'TORNILLO');
    assert.match(n.name.rule!, /^name:model:/);
  });
});

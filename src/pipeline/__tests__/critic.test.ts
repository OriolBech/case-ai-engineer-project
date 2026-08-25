import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criticRoutingFromEnv, needsCritic, criticiseRow } from '../critic.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow, OutputLine } from '../types.ts';
import type { Llm } from '../../lib/llm.ts';

const row: MtoRow = {
  itemRef: '1', sourceText: 'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H',
  cellOffsets: {}, quantity: 40, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: 5,
};

const analysis = (n: number, extra: Partial<Analysis> = {}): Analysis => ({
  rowRef: '1', outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], rejectedMultiplicity: [], skippedLlm: false, tier: 'main', escalated: false, error: null, ...extra,
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
    // La calidad la tiene que haber puesto el extractor, o la puerta de `mayDispute` no deja pasar
    // el veredicto. Es justo el caso real: `ASTM F436` copiado de la fila al campo equivocado, que
    // ninguna tabla del cliente reconoce y sale como `extracted_uncatalogued`.
    const disputed: OutputLine = {
      ...line('1.2', 'RESUELTA'),
      attributes: {
        ...line('1.2', 'RESUELTA').attributes,
        quality: { raw: 'ASTM F436', normalized: 'ASTM F436', provenance: 'extracted_uncatalogued', span: null, rule: null },
      },
    };
    const r = await criticiseRow(llm, row, analysis(2), [line('1.1', 'RESUELTA'), disputed]);
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

  /**
   * El fallo se vio en la fila 63 del set sintético: el crítico se truncaba por `max_tokens` —el
   * nivel razona con `effort=high` y los thinking tokens salen del mismo presupuesto— y la
   * excepción se tragaba. Tres filas revisadas de cuatro elegibles se leía como un detalle de
   * redondeo, no como la fila más difícil del set saliendo sin red.
   */
  test('un crítico que se cae NO se lee igual que un crítico que aprueba', async () => {
    const caido = await criticiseRow(stubLlm(null, { throws: true }), row, analysis(2), [line('1.1', 'RESUELTA')]);
    assert.equal(caido.ran, false);
    assert.match(caido.failure ?? '', /proveedor caído/, 'el motivo del fallo viaja, no se traga');

    const noElegible = await criticiseRow(stubLlm(null), row, analysis(1), [line('1.1', 'RESUELTA')]);
    assert.equal(noElegible.ran, false);
    assert.equal(noElegible.failure, null, 'no elegible no es un fallo, y hay que poder distinguirlos');

    const ok = await criticiseRow(stubLlm({ missingElements: [], verdicts: [] }), row, analysis(2), [line('1.1', 'RESUELTA')]);
    assert.equal(ok.ran, true);
    assert.equal(ok.failure, null);
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

/**
 * La puerta que hace imposible el falso positivo que el crítico comete de verdad.
 *
 * Los cuatro degradados medidos —tres en el gold, uno en la fixture congelada— atacaban los tres
 * una celda que el extractor NO puso: el material derivado por P-3, la norma traducida por la tabla
 * §8, el alcance del acabado decidido por P-1. El prompt ya lo prohíbe por escrito y el modelo lo
 * hace igual, así que la regla vive aquí.
 */
describe('criticiseRow · sólo se discute lo que puso el extractor', () => {
  const cell = (provenance: string) => ({ raw: 'X', normalized: 'X', provenance, span: null, rule: null });
  const withAttr = (id: string, key: string, provenance: string): OutputLine => ({
    ...line(id, 'RESUELTA'),
    attributes: { ...line(id, 'RESUELTA').attributes, [key]: cell(provenance) } as OutputLine['attributes'],
  });
  const dispute = (id: string, attribute: string | null) => ({
    verdicts: [{ lineId: id, agrees: false, issue: 'WRONG_ATTRIBUTION', attribute, explanation: 'no cuadra' }],
    missingElements: [],
  });
  const run = async (l: OutputLine, attribute: string | null) =>
    criticiseRow(stubLlm(dispute(l.id, attribute)), row, analysis(3), [l], 'multi_element');

  test('un material DERIVADO no se discute: lo puso P-3, no el extractor', async () => {
    const c = await run(withAttr('1.2', 'material', 'derived'), 'material');
    assert.deepEqual(c.downgraded, []);
    assert.equal(c.lines[0].status, 'RESUELTA');
  });

  test('una medida EXTRAPOLADA no se discute: la puso §2', async () => {
    const c = await run(withAttr('1.2', 'measure', 'extrapolated'), 'measure');
    assert.deepEqual(c.downgraded, []);
  });

  test('una celda vacía no se discute: no hay nada colocado que pueda estar mal colocado', async () => {
    const c = await run(withAttr('1.2', 'quality', 'absent'), 'quality');
    assert.deepEqual(c.downgraded, []);
  });

  test('un veredicto que no dice qué atributo discute no degrada: no se puede comprobar', async () => {
    const c = await run(withAttr('1.2', 'quality', 'extracted'), null);
    assert.deepEqual(c.downgraded, []);
  });

  test('SÍ degrada el caso para el que existe: una norma metida en el campo calidad', async () => {
    // `ASTM F436` en la calidad de la arandela — literal de la fila, campo equivocado. Es la
    // procedencia `extracted_uncatalogued`, y la puerta tiene que dejarla pasar entera.
    const c = await run(withAttr('1.3', 'quality', 'extracted_uncatalogued'), 'quality');
    assert.deepEqual(c.downgraded, ['1.3']);
    assert.equal(c.lines[0].status, 'REVISION_MANUAL');
  });

  test('una calidad NORMALIZADA POR LA TABLA tampoco se discute, y eso cuesta algo', async () => {
    // El precio consciente de la puerta: `table_normalized` es donde el crítico relitiga la
    // traducción («DIN 933 debería ser ISO 4014», que es al revés de lo que dice §8) y lo archiva
    // como WRONG_ATTRIBUTION, así que ni el atributo ni el `issue` distinguen los dos casos. Con
    // cero verdaderos positivos medidos, se elige no equivocarse nunca.
    const c = await run(withAttr('1.2', 'quality', 'table_normalized'), 'quality');
    assert.deepEqual(c.downgraded, []);
  });

  test('la cantidad no pasa por la puerta: no es uno de los siete atributos', async () => {
    const c = await run(line('1.2', 'RESUELTA'), 'quantity');
    assert.deepEqual(c.downgraded, ['1.2']);
  });
});

describe('criticRoutingFromEnv · el defecto es una medición', () => {
  test('sin variable, apagado', () => {
    assert.equal(criticRoutingFromEnv({} as unknown as NodeJS.ProcessEnv), 'off');
  });
  test('se puede volver a encender explícitamente', () => {
    assert.equal(criticRoutingFromEnv({ CRITIC_ROUTING: 'multi_element' } as unknown as NodeJS.ProcessEnv), 'multi_element');
    assert.equal(criticRoutingFromEnv({ CRITIC_ROUTING: 'all' } as unknown as NodeJS.ProcessEnv), 'all');
  });
  test('un valor que no existe apaga, no revienta ni adivina', () => {
    assert.equal(criticRoutingFromEnv({ CRITIC_ROUTING: 'siempre' } as unknown as NodeJS.ProcessEnv), 'off');
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

describe('validate · una fila nunca desaparece', () => {
  test('0 elementos con descripción produce una línea con motivo, no vacío', async () => {
    const { validateRow } = await import('../validate.ts');
    const a = analysis(0);
    const lines = validateRow(a, [], row);
    assert.equal(lines.length, 1, 'la fila tiene que salir en la salida');
    assert.equal(lines[0].status, 'REVISION_MANUAL');
    assert.equal(lines[0].reasons[0].code, 'NO_ELEMENTS_EXTRACTED');
  });
});

describe('spans · evidencia con comillas escapadas', () => {
  test('7/8" con la comilla escapada se localiza igual', async () => {
    const { locate } = await import('../spans.ts');
    const src = 'STUD BOLT 7/8" X 6" LG, ASTM A193 GR B7';
    const r = locate(src, 'STUD BOLT 7/8\\" X 6\\" LG');
    assert.equal(r.hallucinated, false, 'no es una alucinación: es escapado JSON');
    assert.ok(r.span);
  });
});

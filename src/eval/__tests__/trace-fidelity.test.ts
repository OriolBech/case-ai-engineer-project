/**
 * La fidelidad de la traza: ¿dice el sistema la verdad sobre de dónde salió cada dato?
 *
 * POR QUÉ EXISTE ESTA MÉTRICA. `quantity` estuvo etiquetada en el gold desde el primer día sin que
 * nadie la comparara, y el arnés daba por PERFECTAS dos líneas con 10.000 y 2.500 uds donde el MTO
 * pedía 100 y 50. La procedencia era **el mismo agujero un nivel más abajo**: `GoldCell.provenance`
 * existe desde el principio y ninguna métrica lo miraba. Diez desacuerdos de procedencia en la
 * cantidad vivieron ahí meses sin que nada los enseñara.
 *
 * LAS DOS DECISIONES DE DISEÑO QUE FIJA ESTE FICHERO:
 *
 *   1. **Sólo se gradúa la procedencia si el valor ya coincide.** La procedencia de un valor
 *      equivocado no informa de nada, y contarla castigaría dos veces el mismo fallo.
 *   2. **Va aparte, nunca dentro de las tasas de valor.** Responde a otra pregunta, y meterla dentro
 *      cambiaría por debajo la definición de números ya publicados (invariante 12).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, type GoldLine } from '../harness.ts';
import { ATTRIBUTE_KEYS, type Attribute, type OutputLine, type Provenance } from '../../pipeline/types.ts';

const goldCell = (value: string | number | null, provenance: string, certainty: 'C' | 'P' = 'C') =>
  ({ value, provenance, certainty });

function goldLine(over: Partial<Record<string, unknown>> = {}): GoldLine {
  return {
    id: 'L001', rowRef: '1', role: 'principal', status: 'RESUELTA', reasons: [],
    attributes: {
      name: goldCell('ESPARRAGO', 'extracted'),
      material: goldCell('AC', 'derived'),
      quality: goldCell('GR B7', 'extracted_uncatalogued'),
      measure: goldCell('7/8"', 'extracted'),
      length: goldCell('130 mm', 'extracted'),
      standard: goldCell('ASTM A193', 'extracted'),
      finish: goldCell(null, 'absent'),
    },
    quantity: goldCell(40, 'extracted') as never,
    ...over,
  } as unknown as GoldLine;
}

const attr = (normalized: string | null, provenance: Provenance): Attribute =>
  ({ raw: normalized, normalized, provenance, span: null, rule: null } as Attribute);

function sysLine(over: Partial<Record<string, Attribute>> = {}, quantityProvenance: Provenance = 'extracted'): OutputLine {
  const base: Record<string, Attribute> = {
    name: attr('ESPARRAGO', 'extracted'),
    material: attr('AC', 'derived'),
    quality: attr('GR B7', 'extracted_uncatalogued'),
    measure: attr('7/8"', 'extracted'),
    length: attr('130 mm', 'extracted'),
    standard: attr('ASTM A193', 'extracted'),
    finish: attr(null, 'absent'),
  };
  return {
    id: '1.1', rowRef: '1', status: 'RESUELTA',
    attributes: { ...base, ...over } as unknown as OutputLine['attributes'],
    quantity: 40, quantityProvenance, reasons: [], confidence: 0.9, policiesApplied: [],
  } as OutputLine;
}

const trace = (sys: OutputLine, gold: GoldLine) => evaluate([sys], [gold], 'test').traceFidelity;

describe('fidelidad de traza', () => {
  test('todo igual: 100% y sin desacuerdos', () => {
    const t = trace(sysLine(), goldLine());
    assert.equal(t.pct, 100);
    assert.deepEqual(t.mismatches, []);
    assert.equal(t.total, ATTRIBUTE_KEYS.length + 1, 'las ocho celdas de la línea');
  });

  test('valor bien y procedencia mal: se cuenta, y se dice cuál', () => {
    const t = trace(sysLine({ measure: attr('7/8"', 'extrapolated') }), goldLine());
    assert.equal(t.ok, 7);
    assert.equal(t.total, 8);
    assert.deepEqual(t.mismatches, ['1.1.measure: extracted -> extrapolated']);
  });

  test('valor MAL: la procedencia no se gradúa — un fallo no se castiga dos veces', () => {
    const t = trace(sysLine({ measure: attr('M20', 'extrapolated') }), goldLine());
    assert.equal(t.total, 7, 'la celda del valor equivocado sale del denominador');
    assert.deepEqual(t.mismatches, [], 'y no aparece como desacuerdo de traza');
  });

  test('la cantidad también cuenta: es la octava celda', () => {
    const t = trace(sysLine({}, 'inferred'), goldLine());
    assert.deepEqual(t.mismatches, ['1.1.quantity: extracted -> inferred']);
  });

  test('las celdas de POLÍTICA quedan fuera, igual que en el resto de tasas', () => {
    const gold = goldLine({
      attributes: {
        ...goldLine().attributes,
        material: goldCell('AC', 'derived', 'P'),
      },
    });
    const t = trace(sysLine({ material: attr('AC', 'table_normalized') }), gold);
    assert.equal(t.total, 7, 'la celda de política no entra');
    assert.deepEqual(t.mismatches, []);
  });

  test('no toca las tasas de valor: son preguntas distintas', () => {
    const r = evaluate([sysLine({ measure: attr('7/8"', 'extrapolated') })], [goldLine()], 'test');
    assert.equal(r.silentErrorRate.bad, 0, 'la procedencia mal no es un error silencioso');
    assert.equal(r.usefulAutonomy.pct, 100);
    assert.equal(r.perAttribute.measure.pctC, 100, 'el VALOR de la medida sigue siendo correcto');
    assert.equal(r.traceFidelity.pct, 87.5);
  });
});

/**
 * El acabado desconocido: el único catálogo cerrado que fallaba en SILENCIO.
 *
 * La asimetría que estos tests fijan. Ante un valor que no conoce:
 *   - calidad  -> lo conserva como `extracted_uncatalogued` Y lo declara como hueco (UNKNOWN_VALUE)
 *   - material -> deja la celda vacía Y lo declara como hueco (UNCOVERED_DERIVATION)
 *   - norma    -> la preserva tal cual, extraída
 *   - acabado  -> **nada de lo anterior**
 *
 * El acabado no tenía ninguna de las dos salidas. §9 declara que la AUSENCIA de acabado es un valor
 * válido que no manda nada a revisión, y `normalize.ts` marca un acabado no reconocido como
 * `absent`: así que un acabado nuevo del blind set era literalmente indistinguible de un acabado que
 * la fila no menciona. La línea salía RESUELTA, con una palabra en la fila que nadie había leído, y
 * §9 dice que un elemento con acabado y el mismo sin acabado son referencias DISTINTAS — es decir,
 * el modo de fallo era comprar la referencia equivocada sin un solo aviso en ninguna parte.
 *
 * El arreglo no escanea texto libre buscando palabras que suenen a acabado (eso fabricaría huecos):
 * lee lo que el extractor ya identificó como acabado y la tabla no supo mapear.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow } from '../validate.ts';
import { detectGaps, policyBacklog } from '../coverage.ts';
import { normalizeElement, type NormalizedElement } from '../normalize.ts';
import { DEFAULT_POLICIES } from '../../rules/policies.ts';
import type { Analysis } from '../analyze.ts';
import type { MtoRow } from '../types.ts';

const row = (itemRef: string, sourceText: string): MtoRow => ({
  itemRef,
  sourceText,
  cellOffsets: {}, quantity: 100, quantityColumn: 'CANTIDAD', unit: 'uds', sheet: 'MTO', rowNumber: Number(itemRef) + 1,
});

const analysis = (rowRef: string, n: number): Analysis => ({
  rowRef, outOfFamily: false, outOfFamilyReason: null,
  elements: Array.from({ length: n }, () => ({} as never)),
  hallucinations: [], rejectedMultiplicity: [], skippedLlm: false,
  tier: 'main', escalated: false, error: null,
});

/** Un tornillo completo: los siete atributos resueltos salvo el acabado, que es el parámetro. */
function bolt(finish: string | null): NormalizedElement {
  const v = (value: string | null) =>
    ({ value, span: value ? { start: 0, end: value.length } : null, hallucinated: false });
  return normalizeElement({
    detectedName: 'TORNILLO', normalizedName: 'TORNILLO', role: 'principal',
    span: { start: 0, end: 8 }, multiplicity: 1, multiplicityStated: false,
    attributes: {
      material: v(null), quality: v('8.8'), measure: v('M16x60'),
      length: v(null), standard: v('DIN 933'), finish: v(finish),
    },
  } as never);
}

describe('acabado fuera de catálogo · deja de ser invisible', () => {
  test('un acabado que la tabla no conoce produce un hueco de política', () => {
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, tropicalizado');
    const lines = validateRow(analysis('7', 1), [bolt('tropicalizado')], r);
    const gaps = detectGaps(r, lines);

    const finishGaps = gaps.filter((g) => g.attribute === 'finish');
    assert.equal(finishGaps.length, 1, 'exactamente un hueco, no cero y no dos');
    assert.equal(finishGaps[0].kind, 'UNKNOWN_VALUE');
    assert.equal(finishGaps[0].value, 'tropicalizado');
    assert.match(finishGaps[0].detail, /no está en el catálogo/);
  });

  test('el valor va VERBATIM al hueco: es lo que hay que decidir', () => {
    // Sin el literal no se puede decidir nada: "un acabado desconocido en la fila 7" no es
    // accionable, "Delta-Protekt KL 100 en la fila 7" sí.
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, Delta-Protekt KL 100');
    const lines = validateRow(analysis('7', 1), [bolt('Delta-Protekt KL 100')], r);
    const [gap] = detectGaps(r, lines).filter((g) => g.attribute === 'finish');
    assert.equal(gap.value, 'Delta-Protekt KL 100');
  });

  test('una VARIANTE de un acabado del catálogo no es un hueco: se lee como el acabado base', () => {
    // `GEOMET-500B` es una designación comercial concreta de Geomet, y el catálogo de §9 sólo tiene
    // `GEOMET`. `findFinishes` casa el alias por límite de palabra, así que la variante se lee como
    // el valor del catálogo — que es la lectura correcta de §9 y NO una decisión pendiente.
    //
    // El test existe para fijar la frontera: el hueco es para lo que la tabla no reconoce EN ABSOLUTO,
    // no para cada sufijo comercial de algo que sí reconoce. Sin esta frontera, el backlog se llenaría
    // de variantes de los siete acabados y dejaría de señalar lo que de verdad falta.
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, GEOMET-500B');
    const lines = validateRow(analysis('7', 1), [bolt('GEOMET-500B')], r);
    assert.equal(lines[0].attributes.finish.normalized, 'GEOMET');
    assert.equal(detectGaps(r, lines).filter((g) => g.attribute === 'finish').length, 0);
  });

  test('un acabado del catálogo NO produce hueco', () => {
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, zincado');
    const lines = validateRow(analysis('7', 1), [bolt('zincado')], r);
    assert.equal(lines[0].attributes.finish.normalized, 'CINCADO');
    assert.equal(detectGaps(r, lines).filter((g) => g.attribute === 'finish').length, 0);
  });

  test('§9 intacta: una fila SIN acabado sigue sin producir nada', () => {
    // El invariante que este arreglo no puede romper. La ausencia de acabado es un valor válido y
    // explícito de §9; convertirla en hueco llenaría el backlog con la mitad del catálogo.
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8');
    const lines = validateRow(analysis('7', 1), [bolt(null)], r);
    assert.equal(lines[0].attributes.finish.provenance, 'absent');
    assert.equal(detectGaps(r, lines).filter((g) => g.attribute === 'finish').length, 0);
  });
});

describe('reconocimiento, no atribución · la frontera con P-1', () => {
  test('un acabado CONOCIDO que P-1 no atribuye NO es un hueco', () => {
    // El falso positivo que esto fija, medido sobre el MTO de referencia: P-1 en modo `review` deja
    // `raw: "zincado"` con `normalized: null` a propósito, para decir "está en la fila pero no se lo
    // atribuyo a este elemento". La primera versión de la detección leía eso como "la tabla no
    // conoce zincado" y metía `zincado`, `zinc plated` y `ZN` en el backlog como tres decisiones
    // pendientes que nadie debe: el catálogo las conoce perfectamente.
    //
    // Esas líneas ya llevan FINISH_SCOPE_UNSTATED y se ven en la cola. El hueco es para lo que la
    // tabla no sabe LEER, no para lo que P-1 decide no ASIGNAR.
    const r = row('6', 'Tornillo DIN 931 M16 x 80 con tuerca DIN 934, 8.8, zincado');
    const v = (value: string | null) =>
      ({ value, span: value ? { start: 0, end: value.length } : null, hallucinated: false });
    const el = (name: string, role: 'principal' | 'secondary', finish: string | null) =>
      normalizeElement({
        detectedName: name, normalizedName: name, role,
        span: { start: 0, end: name.length }, multiplicity: 1, multiplicityStated: false,
        attributes: {
          material: v(null), quality: v('8.8'), measure: v('M16'),
          length: v(role === 'principal' ? '80' : null), standard: v('DIN 934'), finish: v(finish),
        },
      } as never);

    const lines = validateRow(analysis('6', 2), [el('TORNILLO', 'principal', 'zincado'), el('TUERCA', 'secondary', null)], r);
    const nut = lines[1];

    // Se comprueba que el escenario es el que se cree: P-1 disparó y dejó el raw sin normalizar.
    assert.ok(nut.reasons.some((x) => x.code === 'FINISH_SCOPE_UNSTATED'), 'P-1 tiene que haber disparado');
    assert.equal(nut.attributes.finish.raw, 'zincado');
    assert.equal(nut.attributes.finish.normalized, null);

    assert.equal(detectGaps(r, lines).filter((g) => g.attribute === 'finish').length, 0);
  });
});

describe('P-12 · acabado desconocido', () => {
  test('con resolve (default) la línea sigue RESUELTA sin motivo', () => {
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, tropicalizado');
    const lines = validateRow(analysis('7', 1), [bolt('tropicalizado')], r);
    assert.equal(lines[0].status, 'RESUELTA');
    assert.equal(lines[0].reasons.length, 0);
  });

  test('con review la línea lleva UNMAPPED_VALUE', () => {
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, tropicalizado');
    const lines = validateRow(analysis('7', 1), [bolt('tropicalizado')], r, {
      policies: { ...DEFAULT_POLICIES, unknownFinish: 'review' },
    });
    assert.ok(lines[0].reasons.some((x) => x.code === 'UNMAPPED_VALUE'));
  });
});

describe('el hueco es del proyecto, no del comprador', () => {
  test('no manda la línea a revisión: el canal es el backlog, no la cola', () => {
    // Misma decisión que los otros huecos (ver la cabecera de coverage.ts): un hueco es un problema
    // de reglas, no de datos. Mandarlo a la cola del comprador le daría algo que él no puede
    // arreglar fila a fila — y lo que hay que decidir se decide UNA vez, no una por línea.
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, tropicalizado');
    const lines = validateRow(analysis('7', 1), [bolt('tropicalizado')], r);

    assert.equal(lines[0].status, 'RESUELTA');
    assert.equal(lines[0].reasons.length, 0, 'ningún motivo de revisión por el acabado desconocido');
    assert.equal(detectGaps(r, lines).filter((g) => g.attribute === 'finish').length, 1);
  });

  test('el hueco trae candidate listo para el front de compras', () => {
    const r = row('7', 'Tornillo DIN 933 M16x60, 8.8, tropicalizado');
    const lines = validateRow(analysis('7', 1), [bolt('tropicalizado')], r);
    const [gap] = detectGaps(r, lines).filter((g) => g.attribute === 'finish');
    assert.ok(gap.candidate);
    assert.equal(gap.candidate!.alias, 'tropicalizado');
    assert.equal(gap.candidate!.id, 'finish-tropicalizado');
  });

  test('el mismo acabado en varias filas es UNA decisión, no una por fila', () => {
    const gaps = ['7', '8', '9'].flatMap((ref) => {
      const r = row(ref, `Tornillo DIN 933 M16x60, 8.8, tropicalizado`);
      return detectGaps(r, validateRow(analysis(ref, 1), [bolt('tropicalizado')], r));
    });

    const backlog = policyBacklog(gaps).filter((b) => b.attribute === 'finish');
    assert.equal(backlog.length, 1, 'una sola entrada de backlog');
    assert.deepEqual(backlog[0].rows, ['7', '8', '9']);
  });
});

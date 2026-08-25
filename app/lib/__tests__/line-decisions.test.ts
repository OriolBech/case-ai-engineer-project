/**
 * Qué se le ofrece decidir a una línea, y con qué urgencia.
 *
 * LA INVARIANTE QUE FIJA ESTE FICHERO, y que se rompió dos veces seguidas:
 *
 *   **Una línea RESUELTA no puede tener una decisión que la esté bloqueando.**
 *
 * La primera rotura fue de estado: una calidad que ningún vocabulario cubría dejaba el material
 * vacío y la línea salía resuelta igual — se arregló en el validador con P-13. La segunda fue de
 * etiqueta, y es más sutil: la línea 24.1 (`GR B16`) está resuelta **con razón** —§5 no la lista y
 * manda conservarla tal cual, su material deriva a AC— y la pantalla le ponía encima "decisiones
 * pendientes" y un aviso en la cola. Nada faltaba; lo que sobraba era la palabra.
 *
 * De ahí las dos categorías. **Bloqueante**: el proyecto debe una decisión ahí (hueco en el backlog)
 * o el atributo es el motivo de revisión de la línea. **Afinado**: la línea sale entera, y aun así
 * hay algo que el comprador sabe y el sistema no. Las dos se ofrecen; sólo la primera se anuncia en
 * la cola y se llama pendiente.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { blockingAttributes, decisionsOf, hasLineDecisions } from '../line-decisions.ts';
import type { PolicyBacklogItem } from '../../../src/pipeline/coverage.ts';
import type { Attribute, OutputLine, Provenance, Reason } from '../../../src/pipeline/types.ts';

const attr = (
  normalized: string | null,
  raw: string | null = null,
  provenance: Provenance = 'extracted',
  rule: string | null = null,
): Attribute => ({ raw, normalized, provenance, span: null, rule } as Attribute);

function line(over: {
  status?: OutputLine['status'];
  quality?: Attribute;
  material?: Attribute;
  finish?: Attribute;
  reasons?: Reason[];
}): OutputLine {
  return {
    id: '24.1',
    rowRef: '24',
    status: over.status ?? 'RESUELTA',
    attributes: {
      name: attr('ESPARRAGO'),
      material: over.material ?? attr('AC', null, 'derived', 'P-3:ac-astm-b16'),
      quality: over.quality ?? attr('GR B16', 'GR B16', 'extracted_uncatalogued', 'quality:out_of_catalog'),
      measure: attr('M16'),
      length: attr('60 mm'),
      standard: attr('ASTM A193'),
      finish: over.finish ?? attr(null, null, 'absent'),
    },
    quantity: 10,
    quantityProvenance: 'extracted',
    reasons: over.reasons ?? [],
    confidence: 0.9,
    policiesApplied: [],
  } as OutputLine;
}

const gap = (over: Partial<PolicyBacklogItem>): PolicyBacklogItem => ({
  kind: 'UNCOVERED_DERIVATION',
  attribute: 'material',
  value: 'GR B16',
  detail: 'detalle',
  rows: ['24'],
  ...over,
} as PolicyBacklogItem);

const reason = (attribute: Reason['attribute']): Reason =>
  ({ code: 'UNMAPPED_VALUE', kind: 'LOW_CONFIDENCE', message: 'x', attribute } as Reason);

describe('una calidad fuera de §5 con material derivado: se ofrece, pero no bloquea', () => {
  test('la 24.1 real: RESUELTA, sin nada pendiente, y aun así se puede afinar', () => {
    const l = line({});
    const d = decisionsOf(l, []);

    assert.equal(d.length, 1, 'se le ofrece declarar el grupo');
    assert.equal(d[0].attribute, 'quality');
    assert.equal(d[0].blocking, false, 'pero NO es una decisión pendiente: la línea está completa');
    assert.match(d[0].title, /intercambiable/, 'el título no pregunta "qué es": el valor no está en duda');
    assert.match(d[0].detail, /completa y correcta/);
  });

  test('no se anuncia en la cola: la cola es la lista de lo que falta', () => {
    assert.deepEqual(blockingAttributes(line({}), []), []);
    assert.equal(hasLineDecisions(line({}), []), false);
  });

  test('lo mismo para GR B7 y GR 2H, que el gold declara RESUELTAS', () => {
    for (const q of ['GR B7', 'GR 2H']) {
      const l = line({ quality: attr(q, q, 'extracted_uncatalogued', 'quality:out_of_catalog') });
      assert.deepEqual(blockingAttributes(l, []), [], `${q} no puede marcar la cola`);
    }
  });
});

describe('lo que sí bloquea', () => {
  test('un hueco del backlog sobre ese atributo', () => {
    const l = line({ status: 'REVISION_MANUAL', material: attr(null, null, 'absent') });
    const d = decisionsOf(l, [gap({})]);
    const mat = d.find((x) => x.attribute === 'material');
    assert.equal(mat?.blocking, true);
    assert.ok(blockingAttributes(l, [gap({})]).includes('material'));
  });

  test('un motivo de revisión colgado de ese atributo, aunque no haya hueco', () => {
    const l = line({
      status: 'REVISION_MANUAL',
      material: attr(null, null, 'absent'),
      reasons: [reason('material')],
    });
    assert.deepEqual(blockingAttributes(l, []), ['material']);
  });

  test('en la misma línea conviven lo que bloquea y lo que sólo afina', () => {
    // La 21.1 real: `GR L7` no deriva material (bloquea, P-13) y además está fuera de §5 (afina).
    const l = line({
      status: 'REVISION_MANUAL',
      quality: attr('GR L7', 'GR L7', 'extracted_uncatalogued', 'quality:out_of_catalog'),
      material: attr(null, null, 'absent'),
      reasons: [reason('material')],
    });
    const d = decisionsOf(l, []);
    assert.deepEqual(d.map((x) => [x.attribute, x.blocking]), [['quality', false], ['material', true]]);
  });
});

describe('la invariante: resuelta y bloqueada a la vez, nunca', () => {
  test('ninguna combinación de línea RESUELTA sin motivos ofrece algo bloqueante', () => {
    const cases: OutputLine[] = [
      line({}),
      line({ quality: attr('8.8', '8.8', 'table_normalized', 'quality:G5') }),
      line({ quality: attr('GR B7', 'GR B7', 'extracted_uncatalogued', 'quality:out_of_catalog') }),
      // Ausencia de material DECIDIDA: válida, resuelta, y ni siquiera se ofrece.
      line({ material: attr(null, null, 'absent', 'P-3:no-derivable') }),
    ];
    for (const l of cases) {
      assert.deepEqual(
        blockingAttributes(l, []), [],
        `una línea RESUELTA no puede tener una decisión bloqueante (calidad ${l.attributes.quality.raw})`,
      );
    }
  });

  test('una ausencia de material decidida no se ofrece siquiera', () => {
    const l = line({ material: attr(null, null, 'absent', 'P-3:no-derivable') });
    assert.equal(decisionsOf(l, []).some((d) => d.attribute === 'material'), false);
  });
});

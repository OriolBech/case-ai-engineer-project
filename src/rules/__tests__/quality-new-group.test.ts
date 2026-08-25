/**
 * Una calidad que no equivale a ninguna de §5: la tercera salida del vocabulario de calidad.
 *
 * EL FALLO QUE CIERRA. El panel sólo dejaba elegir uno de los catorce grupos del cliente. Para una
 * calidad que no es intercambiable con ninguno —`GR 660`, una aleación base níquel— la única salida
 * disponible era declarar una equivalencia **falsa**. O sea: el formulario empujaba a romper la
 * invariante nº4 del proyecto (nunca convertir entre grupos), y de la peor forma posible, porque una
 * equivalencia falsa termina en alguien recibiendo `8.8` donde el plano pedía `GR 660`. Que la salida
 * "no equivale a nada" no existiera no hacía el sistema más conservador: lo hacía más mentiroso.
 *
 * LA FRONTERA QUE ESTOS TESTS PROTEGEN. Los catorce de §5 son el documento del cliente y siguen
 * siendo catorce. Lo nuestro nace aparte, con prefijo `V-`, y jamás puede confundirse con lo suyo —
 * ni en la tabla, ni en el log, ni en la traza de una compra. Y sobre todo: un grupo propio **no**
 * declara equivalencia con nada de §5, que es exactamente lo que se quería decir.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeQualityDb, openQualityDb, resolveQuality } from '../quality-db.ts';
import { addVocab, listQualityGroups } from '../vocab.ts';
import { checkCoherence, normalizeQuality, QUALITY_GROUPS } from '../quality.ts';
import { isKnownGroupShape, isOwnGroup, ownGroupId } from '../quality-groups.ts';

let dir: string;
const SEED = { version: 1, attribute: 'quality', entries: [] };

/**
 * La equivalencia REAL, la de dos capas. `areEquivalent` de `quality.ts` sólo mira §5 y por tanto no
 * sabe nada de lo que el comprador ha declarado — usarla aquí daría el resultado correcto por el
 * motivo equivocado.
 */
const groupOf = (q: string) => resolveQuality(q).group;
const equivalent = (a: string, b: string) => {
  const ga = groupOf(a);
  return ga !== null && ga === groupOf(b);
};

const add = (alias: string, over: Record<string, unknown> = {}) =>
  addVocab({
    attribute: 'quality',
    match: alias,
    value: null,
    kind: 'new_group',
    rationale: 'Aleación base níquel: no equivale a ninguna clase de §5.',
    decidedBy: 'compras',
    ...over,
  } as never);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qual-new-'));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(SEED), 'utf8');
  process.env.VOCAB_QUALITY_DB = join(dir, 'q.sqlite');
  process.env.VOCAB_QUALITY = join(dir, 'seed.json');
  process.env.VOCAB_QUALITY_LOG = join(dir, 'log.jsonl');
  closeQualityDb();
});

afterEach(() => {
  closeQualityDb();
  delete process.env.VOCAB_QUALITY_DB;
  delete process.env.VOCAB_QUALITY;
  delete process.env.VOCAB_QUALITY_LOG;
  rmSync(dir, { recursive: true, force: true });
});

describe('el id de un grupo propio no se puede confundir con uno del cliente', () => {
  test('lleva prefijo y conserva el token, para que se lea en la traza', () => {
    assert.equal(ownGroupId('GR 660'), 'V-GR-660');
    assert.equal(ownGroupId('  gr 660h  '), 'V-GR-660H');
    assert.equal(isOwnGroup('V-GR-660'), true);
    assert.equal(isOwnGroup('G5'), false);
  });

  test('un id que no es ni de §5 ni nuestro sigue siendo un error, no un grupo', () => {
    // Una errata no puede convertirse en una clase de equivalencia por accidente.
    assert.equal(isKnownGroupShape('G5'), true);
    assert.equal(isKnownGroupShape('V-GR-660'), true);
    assert.equal(isKnownGroupShape('G99'), false);
    assert.equal(isKnownGroupShape('gr660'), false);
    assert.equal(isKnownGroupShape('V-'), false);
  });

  test('§5 sigue teniendo catorce', () => {
    assert.equal(QUALITY_GROUPS.size, 14);
  });
});

describe('crear una calidad nueva', () => {
  test('se guarda con su propio grupo y resuelve por vocabulario', () => {
    openQualityDb();
    const r = add('GR 660');
    assert.equal(r.ok, true, r.error ?? '');

    const q = resolveQuality('GR 660');
    assert.equal(q.source, 'vocab');
    assert.equal(q.group, 'V-GR-660');
  });

  test('NO es intercambiable con ninguna calidad de §5: eso era todo el problema', () => {
    openQualityDb();
    add('GR 660');
    for (const other of ['8.8', 'A4-70', '10.9', '8', '200HV']) {
      assert.equal(
        equivalent('GR 660', other), false,
        `un grupo propio no puede declarar equivalencia con ${other}`,
      );
    }
  });

  test('dos calidades nuevas que sí son equivalentes pueden compartir grupo', () => {
    openQualityDb();
    add('GR 660');
    const r = add('GR 660H', { kind: 'equivalence', value: 'V-GR-660' });
    assert.equal(r.ok, true, r.error ?? '');
    assert.equal(equivalent('GR 660', 'GR 660H'), true);
    assert.equal(equivalent('GR 660H', '8.8'), false);
  });

  test('el grupo nuevo aparece en la lista, marcado como nuestro y con sus miembros', () => {
    openQualityDb();
    add('GR 660');
    const groups = listQualityGroups();
    assert.equal(groups.filter((g) => !g.own).length, 14, 'los del cliente siguen siendo catorce');
    const mine = groups.find((g) => g.id === 'V-GR-660');
    assert.ok(mine, 'el propio se ofrece para reutilizarlo');
    assert.equal(mine!.own, true);
    assert.deepEqual(mine!.members, ['GR 660']);
  });

  test('un grupo propio no fabrica incoherencias de tipo: §5 no dice nada de él', () => {
    openQualityDb();
    add('GR 660');
    const q = normalizeQuality('GR 660');
    for (const name of ['TORNILLO', 'TUERCA', 'ARANDELA'] as const) {
      assert.equal(checkCoherence(q, name), null, `${name} con un grupo propio no es incoherente`);
    }
  });
});

describe('las guardas que siguen en pie', () => {
  test('un grupo inventado a mano se rechaza', () => {
    openQualityDb();
    const r = addVocab({
      attribute: 'quality', match: 'GR 660', value: 'G99',
      rationale: '', decidedBy: 'compras',
    } as never);
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /no es uno de los 14/);
  });

  test('declarar un valor que YA está en §5 como grupo propio: se corta en estricto', () => {
    // `8.8` es G5 en el documento del cliente. Sacarlo de ahí a un grupo propio no es un alias, es
    // reescribir sus equivalencias — la guarda que ya existía sigue en pie con la salida nueva.
    openQualityDb();
    const r = add('8.8');
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /ya es un valor de §5/);
  });

  test('y en el modo de la demo (force) se guarda, pero avisando', () => {
    openQualityDb();
    const r = addVocab(
      { attribute: 'quality', match: '8.8', value: null, kind: 'new_group', rationale: 'x', decidedBy: 'compras' } as never,
      { force: true },
    );
    assert.equal(r.ok, true);
    assert.ok(r.warnings.length > 0, 'nunca en silencio');
    assert.match(r.warnings.join(' '), /§5/);
  });

  test('§5 sigue mandando: el valor de catálogo resuelve por catálogo, no por el grupo propio', () => {
    openQualityDb();
    addVocab(
      { attribute: 'quality', match: '8.8', value: null, kind: 'new_group', rationale: 'x', decidedBy: 'compras' } as never,
      { force: true },
    );
    const q = resolveQuality('8.8');
    assert.equal(q.group, 'G5', 'la capa 1 gana siempre');
  });
});

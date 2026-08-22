/**
 * La tabla de derivación: cerrada, trazable y ampliable.
 *
 * Cada test es una de las tres palabras de la respuesta a la Q3 del cliente, más los dos casos que
 * la versión anterior resolvía en silencio: la ambigüedad y la siembra a medias.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addEntry, closeVocabularyDb, deriveMaterial, isDerived, listChanges, listEntries,
  openVocabularyDb, retireEntry,
} from '../vocabulary-db.ts';

let dir: string;

/** Semilla mínima con las dos formas de casar y un grupo declarado no derivable. */
const SEED = {
  version: 1,
  policy: 'P-3',
  entries: [
    {
      id: 'inox-a4', when: { qualityGroup: 'G3' }, material: 'INOX' as const,
      rationale: 'A4 es austenítico con molibdeno.', decidedBy: 'Prueba',
      decidedAt: '2026-01-01', source: 'ISO 3506',
    },
    {
      id: 'ac-8-8', when: { qualityGroup: 'G5' }, material: 'AC' as const,
      rationale: '8.8 es clase ISO 898-1, sólo acero.', decidedBy: 'Prueba',
      decidedAt: '2026-01-01', source: 'ISO 898-1',
    },
    {
      id: 'ac-b7', when: { qualityPattern: '^(GR\\.?\\s*)?B7$' }, material: 'AC' as const,
      rationale: 'B7 es cromo-molibdeno.', decidedBy: 'Prueba',
      decidedAt: '2026-01-01', source: 'ASTM A193',
    },
  ],
  deliberatelyUncovered: [{ match: 'HV', why: 'Una dureza no dice el metal base.' }],
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vocab-'));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(SEED), 'utf8');
  process.env.VOCAB_DB = join(dir, 'v.sqlite');
  process.env.VOCAB_MATERIAL = join(dir, 'seed.json');
  process.env.VOCAB_LOG = join(dir, 'log.jsonl');
  closeVocabularyDb();
});

afterEach(() => {
  closeVocabularyDb();
  delete process.env.VOCAB_DB;
  delete process.env.VOCAB_MATERIAL;
  delete process.env.VOCAB_LOG;
  rmSync(dir, { recursive: true, force: true });
});

describe('cerrada · sólo deriva lo que está en la tabla', () => {
  test('lo que está, deriva, y dice con qué entrada', () => {
    const r = deriveMaterial('A4-70');
    assert.ok(isDerived(r));
    assert.equal(r.material, 'INOX');
    assert.equal(r.entryId, 'inox-a4');
    assert.match(r.rule, /^P-3:/);
  });

  test('los patrones también, no sólo los grupos', () => {
    const r = deriveMaterial('GR B7');
    assert.ok(isDerived(r) && r.material === 'AC');
  });

  test('lo que no está NO sale con material vacío: sale como hueco', () => {
    const r = deriveMaterial('45H');
    assert.ok(!isDerived(r) && r.reason === 'uncovered');
  });

  test('lo declarado no derivable se distingue de lo no cubierto', () => {
    // La diferencia importa: una es una decisión tomada y no produce hueco; la otra es una decisión
    // pendiente y sí. Confundirlas llena el backlog de cosas ya decididas.
    const r = deriveMaterial('200HV');
    assert.ok(!isDerived(r) && r.reason === 'deliberate');
    assert.match(r.reason === 'deliberate' ? r.why : '', /metal base/);
  });
});

describe('no unívoca · la ambigüedad se reporta, no se resuelve', () => {
  test('dos entradas con materiales distintos sobre la misma calidad → ambigua', () => {
    // Se fuerza escribiendo el log a mano, que es lo único que puede producirlo: addEntry lo rechaza.
    writeFileSync(join(dir, 'log.jsonl'), `${JSON.stringify({
      action: 'add', at: '2026-02-01', by: 'Prueba', detail: 'entrada en conflicto',
      entry: {
        id: 'conflicto', matchKind: 'qualityGroup', matchValue: 'G3', material: 'AC',
        rationale: 'en conflicto a propósito', decidedBy: 'Prueba', decidedAt: '2026-02-01', source: 'prueba',
      },
    })}\n`, 'utf8');
    closeVocabularyDb();

    const r = deriveMaterial('A4-70');
    assert.ok(!isDerived(r) && r.reason === 'ambiguous', 'no elige la primera que casa');
    if (!isDerived(r) && r.reason === 'ambiguous') {
      assert.deepEqual(r.candidates.map((c) => c.material).sort(), ['AC', 'INOX']);
    }
  });

  test('dos entradas que coinciden en el material NO son ambiguas', () => {
    addEntry({
      id: 'ac-8-8-bis', matchKind: 'qualityPattern', matchValue: '^8\\.8$', material: 'AC',
      rationale: 'misma conclusión por otra vía', decidedBy: 'Prueba', source: 'prueba',
    }, '2026-02-01');
    const r = deriveMaterial('8.8');
    assert.ok(isDerived(r) && r.material === 'AC');
  });
});

describe('ampliable · y con las guardas que protegen lo que ya funciona', () => {
  test('añadir cubre una calidad que antes era un hueco', () => {
    assert.ok(!isDerived(deriveMaterial('45H')));
    addEntry({
      id: 'ac-45h', matchKind: 'qualityPattern', matchValue: '^45H$', material: 'AC',
      rationale: '45H es clase de tuerca ISO 898-2, sólo acero.', decidedBy: 'Prueba', source: 'ISO 898-2',
    }, '2026-03-01');
    const r = deriveMaterial('45H');
    assert.ok(isDerived(r) && r.material === 'AC' && r.entryId === 'ac-45h');
  });

  test('rechaza una entrada que haría ambigua una calidad que hoy resuelve', () => {
    // Sin esta guarda, añadir una entrada convierte líneas resueltas en revisiones sin que nadie lo
    // haya pedido.
    assert.throws(() => addEntry({
      id: 'otro-g3', matchKind: 'qualityGroup', matchValue: 'G3', material: 'AC',
      rationale: 'contradice inox-a4', decidedBy: 'Prueba', source: 'prueba',
    }, '2026-03-01'), /ambigua/);
  });

  test('rechaza reutilizar un id: es la traza de una compra', () => {
    assert.throws(() => addEntry({
      id: 'inox-a4', matchKind: 'qualityPattern', matchValue: '^X$', material: 'AC',
      rationale: 'id repetido', decidedBy: 'Prueba', source: 'prueba',
    }, '2026-03-01'), /Ya existe/);
  });

  test('el log es la fuente: la base se reconstruye entera desde cero', () => {
    addEntry({
      id: 'ac-45h', matchKind: 'qualityPattern', matchValue: '^45H$', material: 'AC',
      rationale: 'decidido', decidedBy: 'Prueba', source: 'ISO 898-2',
    }, '2026-03-01');

    rmSync(join(dir, 'v.sqlite'), { force: true });
    closeVocabularyDb();
    openVocabularyDb();

    assert.equal(listEntries().length, 4, 'las 3 de la semilla más la añadida');
    assert.ok(isDerived(deriveMaterial('45H')));
  });
});

describe('trazable · el histórico no se reescribe', () => {
  test('retirar no borra: la entrada queda marcada con su motivo', () => {
    retireEntry('ac-b7', 'el cliente aclara que su B7 es una variante inox', 'Prueba', '2026-04-01');
    assert.ok(!isDerived(deriveMaterial('GR B7')), 'deja de derivar');
    const all = listEntries({ includeRetired: true });
    const b7 = all.find((e) => e.id === 'ac-b7');
    assert.equal(b7?.retiredAt, '2026-04-01');
    assert.match(b7?.retiredWhy ?? '', /variante inox/);
  });

  test('no se puede retirar dos veces, ni retirar lo que no existe', () => {
    retireEntry('ac-b7', 'motivo', 'Prueba', '2026-04-01');
    assert.throws(() => retireEntry('ac-b7', 'otra vez', 'Prueba', '2026-04-02'), /ya se retir/);
    assert.throws(() => retireEntry('no-existe', 'motivo', 'Prueba', '2026-04-02'), /No existe/);
  });

  test('cada cambio queda en el histórico con quién y por qué', () => {
    addEntry({
      id: 'ac-45h', matchKind: 'qualityPattern', matchValue: '^45H$', material: 'AC',
      rationale: 'porque ISO 898-2', decidedBy: 'Quien Sea', source: 'ISO 898-2',
    }, '2026-03-01');
    const changes = listChanges();
    const added = changes.find((c) => c.entryId === 'ac-45h');
    assert.equal(added?.action, 'add');
    assert.equal(added?.by, 'Quien Sea');
    assert.match(added?.detail ?? '', /ISO 898-2/);
    assert.equal(changes.filter((c) => c.action === 'seed').length, 3);
  });

  test('aplicar el log dos veces no duplica nada', () => {
    addEntry({
      id: 'ac-45h', matchKind: 'qualityPattern', matchValue: '^45H$', material: 'AC',
      rationale: 'r', decidedBy: 'p', source: 's',
    }, '2026-03-01');
    const before = listChanges().length;
    closeVocabularyDb();
    openVocabularyDb();
    assert.equal(listChanges().length, before);
  });
});

describe('la siembra es todo o nada', () => {
  test('una base a medio sembrar se repara sola en la siguiente apertura', () => {
    // El fallo real: una siembra interrumpida dejó 6 de 12 entradas, y la comprobación de "¿ya está
    // sembrada?" miraba si HABÍA filas en lugar de CUÁNTAS, así que la mitad del catálogo dejó de
    // derivar en silencio para siempre.
    const conn = openVocabularyDb();
    conn.exec(`DELETE FROM entry WHERE id = 'ac-8-8'`);
    assert.equal(listEntries().length, 2);

    closeVocabularyDb();
    openVocabularyDb();
    assert.equal(listEntries().length, 3, 'la entrada que faltaba vuelve');
    assert.ok(isDerived(deriveMaterial('8.8')));
  });

  test('el fichero de log queda con una línea por decisión, legible', () => {
    addEntry({
      id: 'ac-45h', matchKind: 'qualityPattern', matchValue: '^45H$', material: 'AC',
      rationale: 'r', decidedBy: 'p', source: 's',
    }, '2026-03-01');
    const lines = readFileSync(join(dir, 'log.jsonl'), 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).entry.id, 'ac-45h');
  });
});

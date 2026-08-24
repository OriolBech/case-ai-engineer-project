/**
 * Identidad de línea y diff entre revisiones. SPEC-014.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintOf, identifiable, type IdentityParts } from '../identity.ts';
import { diffRevisions, summarizeDiff } from '../revision-diff.ts';
import { classifyPromotion } from '../ports.ts';

const bolt = (over: Partial<IdentityParts> & { id?: string; qty?: number | null; itemRef?: string | null; rowRef?: string } = {}) => {
  const { id = 'L1', qty = 100, itemRef = '10', rowRef = '10', ...parts } = over;
  return identifiable({
    id,
    parts: {
      name: 'TORNILLO',
      material: 'AC',
      quality: '8.8',
      measure: 'M16',
      length: '60 mm',
      standard: 'ISO 4017',
      finish: 'CINCADO',
      ...parts,
    },
    quantity: qty,
    status: 'RESUELTA',
    itemRef,
    rowRef,
  });
};

describe('fingerprintOf', () => {
  test('no cambia si cambian cantidad, ITEM o número de fila', () => {
    const a = bolt({ id: 'a', qty: 100, itemRef: '10', rowRef: '10' });
    const b = bolt({ id: 'b', qty: 10_000, itemRef: null, rowRef: '99' });
    assert.equal(a.fingerprint, b.fingerprint);
  });

  test('acabado vacío y CINCADO no comparten huella', () => {
    const raw = bolt({ finish: 'CINCADO' });
    const bare = bolt({ finish: null });
    assert.notEqual(raw.fingerprint, bare.fingerprint);
  });

  test('fold: DIN 933 y din 933 colapsan igual antes de normalizar a ISO — aquí la huella usa ya el canónico', () => {
    assert.equal(
      fingerprintOf(bolt().parts),
      fingerprintOf({ ...bolt().parts, standard: 'iso 4017' }),
    );
  });
});

describe('diffRevisions', () => {
  test('misma huella, distinta cantidad → qty_changed', () => {
    const prev = [bolt({ id: 'p', qty: 100, rowRef: '4' })];
    const curr = [bolt({ id: 'c', qty: 250, rowRef: '7' })];
    const d = diffRevisions(prev, curr);
    assert.equal(d.length, 1);
    assert.equal(d[0].kind, 'qty_changed');
    if (d[0].kind === 'qty_changed') {
      assert.equal(d[0].from, 100);
      assert.equal(d[0].to, 250);
    }
  });

  test('insertar una fila no convierte el tornillo de abajo en alta+baja', () => {
    const prev = [bolt({ id: 'p', rowRef: '5', itemRef: '5' })];
    const curr = [
      bolt({ id: 'new', name: 'TUERCA', length: null, quality: null, rowRef: '5', itemRef: '5', qty: 40 }),
      bolt({ id: 'c', rowRef: '6', itemRef: '6' }),
    ];
    const d = diffRevisions(prev, curr);
    const kinds = d.map((x) => x.kind).sort();
    assert.deepEqual(kinds, ['added', 'unchanged']);
  });

  test('huella duplicada a un lado → ambiguous, no se inventa el pareado', () => {
    const prev = [bolt({ id: 'p1', qty: 10 }), bolt({ id: 'p2', qty: 20 })];
    const curr = [bolt({ id: 'c', qty: 30 })];
    const d = diffRevisions(prev, curr);
    assert.equal(d.length, 1);
    assert.equal(d[0].kind, 'ambiguous');
  });

  test('alta y baja', () => {
    const prev = [bolt({ id: 'gone', measure: 'M12' })];
    const curr = [bolt({ id: 'new', measure: 'M20' })];
    const s = summarizeDiff(diffRevisions(prev, curr));
    assert.deepEqual(s, { added: 1, removed: 1, qtyChanged: 0, unchanged: 0, ambiguous: 0 });
  });
});

describe('classifyPromotion', () => {
  test('dos valores distintos sobre la misma celda no promocionan a alias', () => {
    assert.equal(classifyPromotion('finish', true).kind, 'policy_decision');
  });

  test('medida y longitud son gramática', () => {
    assert.equal(classifyPromotion('measure', false).kind, 'not_promotable');
    assert.equal(classifyPromotion('length', false).kind, 'not_promotable');
  });

  test('acabado sí va a vocabulario', () => {
    assert.equal(classifyPromotion('finish', false).kind, 'vocab_alias');
  });
});

/**
 * Declarar una calidad NO derivable: la tercera salida del material.
 *
 * POR QUÉ HACÍA FALTA. El acabado siempre tuvo `not_a_finish` — "esto que parece un acabado no lo
 * es" — y el material no tenía su equivalente. La tabla `uncovered` existía desde el principio, con
 * su motivo por fila, pero **sólo la semilla podía escribir en ella**: para decir "de esta calidad no
 * se deduce el metal" había que editar un JSON y desplegar. Desde la pantalla, las únicas salidas
 * eran AC o INOX, y sobre una dureza las dos son inventarse el material — justo lo que el vocabulario
 * entero existe para no hacer.
 *
 * Las dos propiedades que estos tests fijan, más allá de que funcione:
 *   - el motivo es OBLIGATORIO: una ausencia sin porqué es indistinguible de un olvido, y esa
 *     distinción es lo único que aporta declararla;
 *   - no se declara no derivable algo que HOY deriva, porque eso deja la tabla diciendo dos cosas a
 *     la vez sin retirar nada.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addUncovered, closeVocabularyDb, deriveMaterial, isDerived, listChanges, listUncovered,
  openVocabularyDb,
} from '../vocabulary-db.ts';
import { addVocab } from '../vocab.ts';
import { exactQualityPattern } from '../quality-pattern.ts';

let dir: string;

const SEED = {
  version: 1,
  policy: 'P-3',
  entries: [
    {
      id: 'ac-8-8', when: { qualityGroup: 'G5' }, material: 'AC' as const,
      rationale: '8.8 es clase ISO 898-1, sólo acero.', decidedBy: 'Prueba',
      decidedAt: '2026-01-01', source: 'ISO 898-1',
    },
  ],
  deliberatelyUncovered: [{ match: 'HV', why: 'Una dureza no dice el metal base.' }],
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vocab-nd-'));
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

describe('no derivable · el gemelo de “esto no es un acabado”', () => {
  test('una calidad sin cubrir pasa de hueco a ausencia decidida', () => {
    openVocabularyDb();
    const before = deriveMaterial('200HV-ESPECIAL');
    assert.equal(isDerived(before), false);
    assert.equal((before as { reason: string }).reason, 'uncovered', 'antes: nadie la ha mirado');

    addUncovered(
      {
        matchKind: 'qualityPattern',
        matchValue: exactQualityPattern('200HV-ESPECIAL'),
        why: 'Una dureza describe el tratamiento superficial, no el metal base.',
        decidedBy: 'compras',
      },
      '2026-08-25',
    );

    const after = deriveMaterial('200HV-ESPECIAL');
    assert.equal(isDerived(after), false, 'sigue sin material: no se inventa uno');
    assert.equal((after as { reason: string }).reason, 'deliberate', 'ahora: decidido que no se deduce');
    assert.match((after as { why: string }).why, /tratamiento superficial/);
  });

  test('el motivo es obligatorio: sin él no es una decisión, es un olvido', () => {
    openVocabularyDb();
    assert.throws(
      () => addUncovered(
        { matchKind: 'qualityPattern', matchValue: '^X$', why: '   ', decidedBy: 'compras' },
        '2026-08-25',
      ),
      /motivo/i,
    );
  });

  test('no se declara no derivable algo que hoy deriva: primero se retira', () => {
    openVocabularyDb();
    assert.equal(isDerived(deriveMaterial('8.8')), true);
    assert.throws(
      () => addUncovered(
        { matchKind: 'qualityGroup', matchValue: 'G5', why: 'me lo ha dicho un proveedor', decidedBy: 'compras' },
        '2026-08-25',
      ),
      /ya deriva a AC/,
    );
  });

  test('queda en el log, que es la fuente, y en el histórico legible', () => {
    openVocabularyDb();
    addUncovered(
      { matchKind: 'qualityPattern', matchValue: '^GR 660$', why: 'Aleación base níquel: ni AC ni INOX.', decidedBy: 'compras' },
      '2026-08-25',
    );

    const log = readFileSync(join(dir, 'log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const ev = log.find((e) => e.action === 'uncover');
    assert.ok(ev, 'el evento está en el log append-only');
    assert.equal(ev.matchValue, '^GR 660$');
    assert.match(ev.detail, /base níquel/);

    assert.ok(listChanges().some((c) => c.action === 'uncover' && c.detail.includes('níquel')));
  });

  test('la base se reconstruye entera desde el log, como cualquier otra decisión', () => {
    openVocabularyDb();
    addUncovered(
      { matchKind: 'qualityPattern', matchValue: '^GR 660$', why: 'Aleación base níquel.', decidedBy: 'compras' },
      '2026-08-25',
    );
    closeVocabularyDb();
    rmSync(join(dir, 'v.sqlite'), { force: true });
    rmSync(join(dir, 'v.sqlite-wal'), { force: true });
    rmSync(join(dir, 'v.sqlite-shm'), { force: true });

    openVocabularyDb();
    assert.equal((deriveMaterial('GR 660') as { reason: string }).reason, 'deliberate');
    assert.equal(listUncovered().filter((u) => u.matchValue === '^GR 660$').length, 1);
  });

  test('aplicar el log dos veces no duplica la declaración', () => {
    openVocabularyDb();
    addUncovered(
      { matchKind: 'qualityPattern', matchValue: '^GR 660$', why: 'Aleación base níquel.', decidedBy: 'compras' },
      '2026-08-25',
    );
    closeVocabularyDb();
    openVocabularyDb();
    assert.equal(listUncovered().filter((u) => u.matchValue === '^GR 660$').length, 1);
    assert.equal(listChanges().filter((c) => c.action === 'uncover').length, 1);
  });
});

describe('la fachada la enruta igual que el resto de altas', () => {
  test('addVocab con kind not_derivable no exige AC ni INOX', () => {
    openVocabularyDb();
    const r = addVocab({
      attribute: 'material',
      match: exactQualityPattern('GR 660'),
      matchKind: 'qualityPattern',
      kind: 'not_derivable',
      value: null,
      rationale: 'Aleación base níquel: no es ni acero ni inoxidable.',
      decidedBy: 'compras',
    });
    assert.equal(r.ok, true);
    assert.equal((deriveMaterial('GR 660') as { reason: string }).reason, 'deliberate');
  });

  test('sin kind, sigue exigiendo AC o INOX y lo dice con la tercera salida', () => {
    openVocabularyDb();
    const r = addVocab({
      attribute: 'material',
      match: exactQualityPattern('GR 660'),
      matchKind: 'qualityPattern',
      value: 'ACERO' as never,
      rationale: '',
      decidedBy: 'compras',
    });
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /AC o INOX, o declararse no derivable/);
  });
});

describe('el patrón ata la entrada a UNA calidad', () => {
  test('anclado y escapado: no cubre de más', () => {
    const p = exactQualityPattern('GR 12H');
    assert.equal(new RegExp(p, 'i').test('GR 12H'), true);
    assert.equal(new RegExp(p, 'i').test('GR 12HX'), false, 'sin anclar cubriría de más');
    assert.equal(new RegExp(exactQualityPattern('A4-70')).test('A4-70'), true);
    assert.equal(new RegExp(exactQualityPattern('A4.70')).test('A4X70'), false, 'el punto se escapa');
  });
});

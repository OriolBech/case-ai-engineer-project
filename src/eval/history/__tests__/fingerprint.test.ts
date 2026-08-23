/**
 * Huellas reproducibles. Ver SPEC-010 §Comportamiento, puntos 2-3.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addEntry, closeVocabularyDb } from '../../../rules/vocabulary-db.ts';
import { DEFAULT_POLICIES } from '../../../rules/policies.ts';
import { datasetFingerprint, policyFingerprint, vocabularyFingerprint } from '../fingerprint.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eval-history-fp-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('huella del dataset', () => {
  test('reproducible: el mismo contenido produce la misma huella', () => {
    const input = join(dir, 'in.xlsx');
    const gold = join(dir, 'gold.jsonl');
    writeFileSync(input, 'contenido-entrada');
    writeFileSync(gold, 'contenido-gold');
    assert.equal(datasetFingerprint(input, gold), datasetFingerprint(input, gold));
  });

  test('cambiar el gold cambia la huella aunque la entrada no cambie', () => {
    const input = join(dir, 'in.xlsx');
    const gold = join(dir, 'gold.jsonl');
    writeFileSync(input, 'contenido-entrada');
    writeFileSync(gold, 'contenido-gold-v1');
    const fp1 = datasetFingerprint(input, gold);
    writeFileSync(gold, 'contenido-gold-v2');
    const fp2 = datasetFingerprint(input, gold);
    assert.notEqual(fp1, fp2);
  });

  test('cambiar la entrada cambia la huella aunque el gold no cambie', () => {
    const input = join(dir, 'in.xlsx');
    const gold = join(dir, 'gold.jsonl');
    writeFileSync(input, 'contenido-entrada-v1');
    writeFileSync(gold, 'contenido-gold');
    const fp1 = datasetFingerprint(input, gold);
    writeFileSync(input, 'contenido-entrada-v2');
    const fp2 = datasetFingerprint(input, gold);
    assert.notEqual(fp1, fp2);
  });
});

describe('huella de políticas', () => {
  test('reproducible y sensible a un cambio de política', () => {
    const fp1 = policyFingerprint(DEFAULT_POLICIES);
    const fp2 = policyFingerprint({ ...DEFAULT_POLICIES, materialDerivation: 'off' });
    assert.equal(policyFingerprint(DEFAULT_POLICIES), fp1);
    assert.notEqual(fp1, fp2);
  });
});

describe('huella de vocabulario', () => {
  beforeEach(() => {
    const seed = {
      version: 1,
      policy: 'P-3',
      entries: [
        {
          id: 'inox-a4',
          when: { qualityGroup: 'G3' },
          material: 'INOX',
          rationale: 'r',
          decidedBy: 'p',
          decidedAt: '2026-01-01',
          source: 's',
        },
      ],
    };
    writeFileSync(join(dir, 'seed.json'), JSON.stringify(seed));
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
  });

  test('cambia al añadir una entrada: el vocabulario es una tabla determinista que puede mover el resultado', () => {
    const before = vocabularyFingerprint();
    addEntry(
      { id: 'ac-45h', matchKind: 'qualityPattern', matchValue: '^45H$', material: 'AC', rationale: 'r', decidedBy: 'p', source: 's' },
      '2026-02-01',
    );
    const after = vocabularyFingerprint();
    assert.notEqual(before, after);
  });
});

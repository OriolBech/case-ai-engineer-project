import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addGenericAlias,
  closeGenericAliasDb,
  listGenericAliases,
} from '../generic-alias-db.ts';
import { addVocab } from '../vocab.ts';
import { findNames, normalizeName } from '../names.ts';
import { normalizeQuality } from '../quality.ts';
import { findStandards, normalizeStandard } from '../standards.ts';
import { normalizeElement } from '../../pipeline/normalize.ts';
import type { AnalyzedElement, AnalyzedValue } from '../../pipeline/analyze.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'generic-alias-'));
  process.env.VOCAB_GENERIC_DB = join(dir, 'aliases.sqlite');
  process.env.VOCAB_GENERIC_LOG = join(dir, 'aliases.log.jsonl');
  closeGenericAliasDb();
});

afterEach(() => {
  closeGenericAliasDb();
  delete process.env.VOCAB_GENERIC_DB;
  delete process.env.VOCAB_GENERIC_LOG;
  rmSync(dir, { recursive: true, force: true });
});

function add(
  id: string,
  attribute: 'name' | 'quality' | 'standard',
  alias: string,
  value: string,
): void {
  addGenericAlias(
    {
      id,
      attribute,
      alias,
      value,
      rationale: 'Confirmado por compras.',
      decidedBy: 'Comprador A',
      evidence: alias,
    },
    '2026-08-24T12:00:00Z',
  );
}

describe('capa 2 sin sobrescribir el catálogo del cliente', () => {
  test('la fachada rechaza un alias que ya pertenece a la capa 1', () => {
    const result = addVocab({
      attribute: 'name',
      match: 'BOLT',
      value: 'TUERCA',
      rationale: 'No debe aplicar.',
      decidedBy: 'Comprador A',
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /capa 1/);
  });

  test('aunque exista una fila externa conflictiva, la capa 1 conserva precedencia', () => {
    add('bad-external-row', 'name', 'BOLT', 'TUERCA');
    assert.equal(normalizeName('BOLT')?.value, 'TORNILLO');
    assert.deepEqual(findNames('BOLT M10').map((hit) => hit.value), ['TORNILLO']);
  });
});

describe('resolución determinista de alias añadidos', () => {
  test('nombre, calidad y norma llegan a la etapa de normalización', () => {
    add('name-casa', 'name', 'FIJADOR CASA', 'TORNILLO');
    add('quality-casa', 'quality', 'Q-CASA', 'A4-70');
    add('standard-casa', 'standard', 'NORMA CASA 14', 'ISO 4014');

    const value = (raw: string): AnalyzedValue => ({
      value: raw,
      span: { start: 0, end: raw.length },
      hallucinated: false,
    });
    const absent: AnalyzedValue = { value: null, span: null, hallucinated: false };
    const input: AnalyzedElement = {
      detectedName: 'FIJADOR CASA',
      normalizedName: null,
      role: 'principal',
      span: { start: 0, end: 12 },
      multiplicity: 1,
      multiplicityStated: false,
      attributes: {
        material: absent,
        quality: value('Q-CASA'),
        measure: absent,
        length: absent,
        standard: value('NORMA CASA 14'),
        finish: absent,
      },
    };

    const normalized = normalizeElement(input);
    assert.equal(normalized.name.normalized, 'TORNILLO');
    assert.equal(normalized.name.rule, 'name:alias:name-casa->TORNILLO');
    assert.equal(normalized.quality.normalized, 'Q-CASA', 'la calidad se emite como se escribió');
    assert.equal(normalized.qualityResult?.resolved, 'A4-70');
    assert.match(normalized.quality.rule ?? '', /quality:alias:quality-casa/);
    assert.equal(normalized.standard.normalized, 'ISO 4014');
    assert.equal(normalized.standard.rule, 'standard:alias:standard-casa');
    assert.deepEqual(findStandards('PERNO NORMA CASA 14').map((hit) => hit.result.normalized), [
      'ISO 4014',
    ]);
    assert.equal(normalizeQuality('Q-CASA').group, 'G3');
    assert.equal(normalizeStandard('NORMA CASA 14')?.normalized, 'ISO 4014');
  });

  test('un alias de calidad externo con destino desconocido no convierte el valor en catalogado', () => {
    add('quality-invalid', 'quality', 'Q-DESCONOCIDA', 'CALIDAD INVENTADA');
    const result = normalizeQuality('Q-DESCONOCIDA');
    assert.equal(result.inCatalog, false);
    assert.equal(result.group, null);
    assert.equal(result.aliasEntryId, null);
  });

  test('el log append-only reconstruye la vista SQLite', () => {
    add('name-casa', 'name', 'FIJADOR CASA', 'TORNILLO');
    const log = readFileSync(process.env.VOCAB_GENERIC_LOG!, 'utf8');
    assert.equal(log.trim().split('\n').length, 1);
    closeGenericAliasDb();
    rmSync(process.env.VOCAB_GENERIC_DB!, { force: true });
    assert.equal(listGenericAliases().length, 1);
  });
});

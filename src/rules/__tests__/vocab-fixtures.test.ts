/**
 * Fixtures MTO realistas para el vocabulario de acabado. Ver data/vocabulary/fixtures/README.md.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveFinish } from '../finish-db.ts';

interface FixtureRow {
  id: string;
  acabadoExtraido: string;
  accionEsperada: 'ya_cubierto' | 'alta_alias' | 'not_a_finish' | 'escalar' | 'trampa_zincado';
  finishDestino: string;
}

function parseFixtures(): FixtureRow[] {
  const text = readFileSync(join('data', 'vocabulary', 'fixtures', 'acabados-mto.csv'), 'utf8');
  const [, ...body] = text.trim().split('\n');
  return body.filter(Boolean).map((line) => {
    const fields: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
        } else cur += ch;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
    fields.push(cur);
    return {
      id: fields[0],
      acabadoExtraido: fields[6],
      accionEsperada: fields[7] as FixtureRow['accionEsperada'],
      finishDestino: fields[8],
    };
  });
}

describe('fixtures MTO · vocabulario de acabado', () => {
  for (const row of parseFixtures()) {
    test(`${row.id}: ${row.acabadoExtraido}`, () => {
      const r = resolveFinish(row.acabadoExtraido);
      if (row.accionEsperada === 'ya_cubierto') {
        assert.equal(r.kind, 'known', row.id);
        assert.equal(r.kind === 'known' ? r.finish : null, row.finishDestino);
      } else if (row.accionEsperada === 'alta_alias' || row.accionEsperada === 'not_a_finish') {
        assert.equal(r.kind, 'unknown', `${row.id}: debería estar pendiente de decisión`);
      } else if (row.accionEsperada === 'trampa_zincado') {
        assert.equal(r.kind, 'known');
        assert.equal(r.finish, row.finishDestino);
      } else {
        assert.ok(r.kind === 'unknown' || r.kind === 'ambiguous', row.id);
      }
    });
  }
});

describe('convención · ids sugeridos únicos', () => {
  test('no hay ids duplicados en el CSV', () => {
    const text = readFileSync(join('data', 'vocabulary', 'fixtures', 'acabados-mto.csv'), 'utf8');
    const ids = [...text.matchAll(/^V\d+,/gm)].map((m) => m[0].slice(0, -1));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 21);
  });
});

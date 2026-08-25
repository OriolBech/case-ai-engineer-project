import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET, PATCH, POST } from '../../../../app/api/corrections/route.ts';
import { closeHistoryDb, openHistoryDb } from '../db.ts';
import { closeGenericAliasDb } from '../../../rules/generic-alias-db.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'corrections-api-'));
  process.env.EVAL_HISTORY_DB = join(dir, 'history.sqlite');
  process.env.VOCAB_GENERIC_DB = join(dir, 'generic.sqlite');
  process.env.VOCAB_GENERIC_LOG = join(dir, 'generic.log.jsonl');
  closeHistoryDb();
  closeGenericAliasDb();
});

afterEach(() => {
  closeHistoryDb();
  closeGenericAliasDb();
  delete process.env.EVAL_HISTORY_DB;
  delete process.env.VOCAB_GENERIC_DB;
  delete process.env.VOCAB_GENERIC_LOG;
  rmSync(dir, { recursive: true, force: true });
});

test('API lista pendientes, decide con actor y exige confirmación de regresión', async () => {
  const create = await POST(
    new Request('http://localhost/api/corrections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rowRef: '7',
        lineId: null,
        attribute: 'name',
        previousValue: null,
        correctedValue: 'TORNILLO',
        evidence: 'FIJADOR CASA',
        rationale: 'Nombre confirmado por compras.',
        rowSourceText: 'FIJADOR CASA M10',
        author: 'Comprador',
      }),
    }),
  );
  assert.equal(create.status, 200);
  const { id } = (await create.json()) as { id: string };

  const listed = (await (await GET()).json()) as {
    pending: { id: string }[];
    approved: unknown[];
  };
  assert.deepEqual(listed.pending.map((row) => row.id), [id]);
  assert.equal(listed.approved.length, 0);

  const withoutActor = await PATCH(
    new Request('http://localhost/api/corrections', {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'approve' }),
    }),
  );
  assert.equal(withoutActor.status, 400);

  const approved = await PATCH(
    new Request('http://localhost/api/corrections', {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'approve', actor: 'Aprobador' }),
    }),
  );
  assert.equal(approved.status, 200);

  const noRegression = await PATCH(
    new Request('http://localhost/api/corrections', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        action: 'promote',
        actor: 'Promotor',
        promotedEntryId: 'name-fijador-casa',
        regressionConfirmed: false,
      }),
    }),
  );
  assert.equal(noRegression.status, 409);

  const promoted = await PATCH(
    new Request('http://localhost/api/corrections', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        action: 'promote',
        actor: 'Promotor',
        promotedEntryId: 'name-fijador-casa',
        regressionConfirmed: true,
      }),
    }),
  );
  assert.equal(promoted.status, 200);
  const row = openHistoryDb()
    .prepare(`SELECT status, approved_by, promoted_by FROM human_corrections WHERE id = ?`)
    .get(id) as { status: string; approved_by: string; promoted_by: string };
  assert.equal(row.status, 'PROMOTED');
  assert.equal(row.approved_by, 'Aprobador');
  assert.equal(row.promoted_by, 'Promotor');
});

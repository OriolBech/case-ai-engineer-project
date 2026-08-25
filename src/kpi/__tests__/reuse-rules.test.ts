import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vocabularyEntryIdFromRule } from '../../../app/lib/mto-history-db.ts';

test('extrae ids promovidos de las cinco familias de vocabulario', () => {
  assert.equal(vocabularyEntryIdFromRule('P-3:material-a4'), 'material-a4');
  assert.equal(vocabularyEntryIdFromRule('P-12:finish-hdg'), 'finish-hdg');
  assert.equal(vocabularyEntryIdFromRule('name:alias:name-casa->TORNILLO'), 'name-casa');
  assert.equal(vocabularyEntryIdFromRule('quality:alias:quality-casa->A4-70'), 'quality-casa');
  assert.equal(vocabularyEntryIdFromRule('standard:alias:standard-casa'), 'standard-casa');
  assert.equal(vocabularyEntryIdFromRule('quality:G3'), null);
});

/**
 * The trap bank is the measurement that does not depend on the 15-row gold.
 * Must traps are client-rule invariants. Hole traps document what tables alone still miss.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTrapBank, formatTrapBank } from '../traps.ts';

test('banco de trampas · las must las decide una regla, no el gold, y no se rompen', () => {
  const report = runTrapBank();
  assert.equal(
    report.must.failed.length,
    0,
    formatTrapBank(report),
  );
});

test('banco de trampas · hay agujeros nombrados del baseline (si se cierran, este test sigue verde)', () => {
  const report = runTrapBank();
  assert.ok(report.holes.total >= 1, 'el banco tiene que seguir documentando el delta que compra el modelo');
});

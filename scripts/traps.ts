/**
 * `pnpm run traps`
 * Scorecard of the trap bank against the deterministic pipeline. No API key.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { runTrapBank, formatTrapBank } from '../src/eval/traps.ts';

installErrorHandler();
const report = runTrapBank();
console.log(formatTrapBank(report));
if (report.must.failed.length) process.exit(1);

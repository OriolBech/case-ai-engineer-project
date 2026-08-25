/**
 * `pnpm corrections:promote -- <id>` — promoción explícita tras regresión.
 *
 * Sin `--regression-passed` no promociona: recuerda ejecutar eval primero.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { orchestratePromotion } from '../src/eval/history/promote.ts';

installErrorHandler();
loadEnv();

const args = process.argv.slice(2).filter((a) => a !== '--');
const id = args.find((a) => !a.startsWith('--'));
const regressionPassed = args.includes('--regression-passed');
const entryArg = args.find((a) => a.startsWith('--entry-id='));
const promotedEntryId = entryArg?.slice('--entry-id='.length);
const actorArg = args.find((a) => a.startsWith('--actor='));
const actor = actorArg?.slice('--actor='.length);

if (!id) {
  console.error('\nUso: pnpm corrections:promote -- <correction-id> [--regression-passed] [--entry-id=<vocab-id>] [--actor=<etiqueta>]\n');
  process.exit(1);
}

if (!regressionPassed) {
  console.log('\nEjecuta primero la regresión:\n  pnpm run eval -- --save\n');
  console.log('Si pasa, promociona con:');
  console.log(`  pnpm corrections:promote -- ${id} --regression-passed --entry-id=<vocab-id> --actor=<etiqueta>\n`);
  process.exit(0);
}

try {
  orchestratePromotion(id, {
    regressionPassed: true,
    promotedEntryId,
    actor: actor ?? '',
  });
  console.log(`\n✓ Corrección ${id} promovida.\n`);
} catch (e) {
  console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}

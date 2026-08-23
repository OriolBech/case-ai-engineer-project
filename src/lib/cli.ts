/**
 * Top-level error handling for the CLI scripts.
 *
 * A stack trace is the wrong output for "the account has no credit": it buries an actionable
 * message under twenty frames of internals. In a live demo that matters more than it should.
 */
import { LlmError } from './llm.ts';

export function installErrorHandler(): void {
  const report = (e: unknown): never => {
    if (e instanceof LlmError || (e instanceof Error && /Sin crédito|API key|Límite de peticiones/.test(e.message))) {
      console.error(`\n✖ ${e.message.split('\n')[0]}`);
      const detail = e instanceof Error ? e.message.split('\n').slice(1).join('\n').trim() : '';
      if (detail) console.error(`  ${detail}`);
      console.error('\n  El pipeline determinista y la caché siguen funcionando:');
      console.error('    pnpm run rules:audit      tablas y baseline, sin modelo');
      console.error('    pnpm run run              si las filas ya están en la caché\n');
      process.exit(2);
    }
    console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}\n`);
    if (e instanceof Error && e.stack && process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  };
  process.on('uncaughtException', report);
  process.on('unhandledRejection', report);
}

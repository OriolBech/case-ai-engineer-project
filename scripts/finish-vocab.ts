/**
 * `pnpm run finish:vocab` — tabla de alias de acabado: consultar, ampliar y auditar.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import {
  addEntry, listChanges, listEntries, resolveFinish, retireEntry,
  type Finish, type FinishAliasKind, type NewFinishAlias,
} from '../src/rules/finish-db.ts';

installErrorHandler();
loadEnv();

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'list';
const flag = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const today = (): string => flag('at') ?? new Date().toISOString().slice(0, 10);

function list(): void {
  const entries = listEntries({ includeRetired: argv.includes('--all') });
  console.log(`\nVOCABULARIO DE ACABADO · ${entries.filter((e) => !e.retiredAt).length} entradas vivas\n`);
  for (const e of entries) {
    const out = e.kind === 'alias' ? e.finish : 'no-acabado';
    const state = e.retiredAt ? `  [RETIRADA ${e.retiredAt}: ${e.retiredWhy}]` : '';
    console.log(`  ${e.alias.padEnd(28)} → ${String(out).padEnd(24)} ${e.id}${state}`);
    console.log(`       ${e.rationale}`);
    console.log(`       ${e.decidedBy} · ${e.decidedAt} · ${e.evidence}\n`);
  }
}

function test(): void {
  const alias = flag('alias') ?? argv[1];
  if (!alias) throw new Error("Falta el alias: pnpm run finish:vocab -- test --alias='tropicalizado'");
  const r = resolveFinish(alias);
  console.log(`\n${alias}`);
  if (r.kind === 'known') {
    console.log(`  → ${r.finish}  (entrada ${r.entryId})`);
  } else if (r.kind === 'not_a_finish') {
    console.log('  → no es acabado, a propósito');
    console.log(`  ${r.why}`);
  } else if (r.kind === 'ambiguous') {
    console.log('  → AMBIGUO');
    for (const c of r.candidates) console.log(`     ${c.entryId}: ${c.alias} → ${c.finish ?? 'no-acabado'}`);
  } else {
    console.log('  → desconocido: hueco de política + P-12');
  }
}

function add(): void {
  const id = flag('id');
  const alias = flag('alias');
  const kind = (flag('kind') ?? 'alias') as FinishAliasKind;
  const finish = flag('finish') as Finish | undefined;
  const why = flag('why');
  const by = flag('by');
  const evidence = flag('evidence');
  const allowShort = argv.includes('--allow-short');

  const missing = [
    !id && '--id', !alias && '--alias', !why && '--why', !by && '--by', !evidence && '--evidence',
    kind === 'alias' && !finish && '--finish',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Faltan ${missing.join(', ')}.\n\n` +
      `  pnpm run finish:vocab -- add --id=finish-tropicalizado --alias=tropicalizado --finish=CINCADO \\\n` +
      `    --why='...' --by='...' --evidence='pliego pág. 12'\n`,
    );
  }

  const entry: NewFinishAlias = {
    id: id!,
    alias: alias!,
    kind,
    finish: kind === 'not_a_finish' ? null : finish!,
    rationale: why!,
    decidedBy: by!,
    source: 'added',
    evidence: evidence!,
  };
  addEntry(entry, today(), undefined, { allowShortAlias: allowShort });
  console.log(`\nAñadida '${id}': ${alias} → ${kind === 'alias' ? finish : 'no-acabado'}`);
}

function retire(): void {
  const id = flag('id');
  const why = flag('why');
  const by = flag('by');
  if (!id || !why || !by) throw new Error("Faltan campos: --id, --why, --by");
  retireEntry(id, why, by, today());
  console.log(`\nRetirada '${id}'.`);
}

function log(): void {
  const changes = listChanges(Number(flag('limit') ?? 50));
  console.log(`\nHISTÓRICO · ${changes.length} cambios\n`);
  for (const c of changes) {
    console.log(`  ${c.at}  ${c.action.padEnd(6)} ${c.entryId.padEnd(24)} ${c.by}`);
    console.log(`              ${c.detail}`);
  }
}

const commands: Record<string, () => void> = { list, test, add, retire, log };
const run = commands[cmd];
if (!run) {
  console.log(`\nSubcomandos: ${Object.keys(commands).join(' · ')}\n`);
  process.exit(1);
}
run();

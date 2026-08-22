/**
 * `npm run vocab` — la tabla de derivación de material: consultarla, ampliarla y auditarla.
 *
 * Es la parte "el cliente puede cambiar una regla sin un despliegue" hecha de verdad. Cada subcomando
 * corresponde a una pregunta que alguien hace en una reunión:
 *
 *   list      ¿qué deriva el sistema hoy, y quién lo decidió?
 *   gaps      ¿qué calidades ha visto y no sabe derivar?  (necesita un fichero)
 *   test      ¿qué haría con esta calidad concreta, y por qué?
 *   add       queremos que 45H derive a AC, y aquí está el argumento
 *   retire    aquella decisión estaba mal, y aquí está el motivo
 *   log       ¿qué ha cambiado, cuándo y por quién?
 *
 * El log es la fuente de la verdad y va en git; la base es una vista de él. Así el historial de
 * decisiones sobre qué material se compra es diffable y revisable como el código.
 */
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import {
  addEntry, deriveMaterial, isDerived, listChanges, listEntries, listUncovered, retireEntry,
  type MatchKind, type Material,
} from '../src/rules/vocabulary-db.ts';

installErrorHandler();
loadEnv();

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'list';
const flag = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/** Sin `--at`, hoy. Se puede fijar para que un test sea reproducible. */
const today = (): string => flag('at') ?? new Date().toISOString().slice(0, 10);

function list(): void {
  const entries = listEntries({ includeRetired: argv.includes('--all') });
  console.log(`\nTABLA DE DERIVACIÓN DE MATERIAL · ${entries.filter((e) => !e.retiredAt).length} entradas vivas`);
  console.log('Sólo lo que está aquí deriva. Cualquier otra calidad va a revisión o a decisión pendiente.\n');
  for (const e of entries) {
    const match = e.matchKind === 'qualityGroup' ? `grupo ${e.matchValue}` : `patrón ${e.matchValue}`;
    const state = e.retiredAt ? `  [RETIRADA ${e.retiredAt}: ${e.retiredWhy}]` : '';
    console.log(`  ${e.material.padEnd(4)} ← ${match.padEnd(28)} ${e.id}${state}`);
    console.log(`       ${e.rationale}`);
    console.log(`       ${e.decidedBy} · ${e.decidedAt} · ${e.source}\n`);
  }
  const unc = listUncovered();
  if (unc.length) {
    console.log(`NO DERIVABLES A PROPÓSITO · ${unc.length}`);
    console.log('Estar aquí es una decisión tomada, no una laguna: no producen hueco.\n');
    for (const u of unc) console.log(`  ${u.matchValue.padEnd(6)} ${u.why}`);
  }
}

function test(): void {
  const quality = flag('quality') ?? argv[1];
  if (!quality) throw new Error("Falta la calidad: npm run vocab -- test --quality='45H'");
  const r = deriveMaterial(quality);
  console.log(`\n${quality}`);
  if (isDerived(r)) {
    console.log(`  → ${r.material}  (entrada ${r.entryId})`);
    console.log(`  ${r.rationale}`);
    console.log(`  Decidido por ${r.decidedBy}. La línea sale RESUELTA con el material marcado como derivado.`);
  } else if (r.reason === 'deliberate') {
    console.log('  → sin material, a propósito');
    console.log(`  ${r.why}`);
    console.log('  No es un hueco: es una ausencia declarada. La línea puede salir resuelta sin material.');
  } else if (r.reason === 'ambiguous') {
    console.log('  → A REVISIÓN: la tabla la cubre dos veces con materiales distintos');
    for (const c of r.candidates) console.log(`     ${c.entryId} dice ${c.material}`);
    console.log('  Retira una de las dos entradas con su motivo para desambiguar.');
  } else {
    console.log('  → sin cubrir: DECISIÓN PENDIENTE del proyecto');
    console.log('  La línea sale sin material y la fila produce un hueco de política.');
    console.log(`  Para decidirlo:\n     npm run vocab -- add --id=... --group=... --material=AC|INOX \\`);
    console.log(`       --why='...' --by='...' --source='...'`);
  }
}

function add(): void {
  const id = flag('id');
  const group = flag('group');
  const pattern = flag('pattern');
  const material = flag('material') as Material | undefined;
  const why = flag('why');
  const by = flag('by');
  const source = flag('source');

  const missing = [
    !id && '--id', !material && '--material', !why && '--why', !by && '--by', !source && '--source',
    !group && !pattern && '--group o --pattern',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Faltan ${missing.join(', ')}.\n\n` +
      `  npm run vocab -- add --id=ac-45h --group=G15 --material=AC \\\n` +
      `    --why='45H es una clase de tuerca ISO 898-2, sólo definida en acero' \\\n` +
      `    --by='Nombre Apellido' --source='ISO 898-2 tabla 3'\n\n` +
      'Los cinco campos no son burocracia: son lo que hace que dentro de un año se pueda decir por ' +
      'qué se compró acero y no inoxidable.',
    );
  }
  if (material !== 'AC' && material !== 'INOX') throw new Error("--material tiene que ser AC o INOX.");

  addEntry({
    id: id!, material,
    matchKind: (group ? 'qualityGroup' : 'qualityPattern') as MatchKind,
    matchValue: group ?? pattern!,
    rationale: why!, decidedBy: by!, source: source!,
  }, today());

  console.log(`\nAñadida '${id}': ${group ?? pattern} → ${material}`);
  console.log('Escrita en el log (que va en git) y aplicada a la base. Sin despliegue.');
  console.log(`Comprueba el efecto:  npm run vocab -- test --quality='...'`);
}

function retire(): void {
  const id = flag('id');
  const why = flag('why');
  const by = flag('by');
  if (!id || !why || !by) {
    throw new Error(
      "Faltan campos: npm run vocab -- retire --id=... --why='...' --by='...'\n\n" +
      'Una entrada no se borra: se retira con su motivo. Lo que se compró bajo esa regla sigue ' +
      'necesitando la regla para explicarse.',
    );
  }
  retireEntry(id, why, by, today());
  console.log(`\nRetirada '${id}'. Sigue en la tabla marcada como retirada — el histórico no se reescribe.`);
}

function log(): void {
  const changes = listChanges(Number(flag('limit') ?? 50));
  console.log(`\nHISTÓRICO · ${changes.length} cambios, del más reciente al más antiguo\n`);
  for (const c of changes) {
    console.log(`  ${c.at}  ${c.action.padEnd(6)} ${c.entryId.padEnd(20)} ${c.by}`);
    console.log(`              ${c.detail}`);
  }
}

async function gaps(): Promise<void> {
  const file = flag('file') ?? argv[1];
  if (!file) throw new Error("Falta el fichero: npm run vocab -- gaps --file=data/input/MTO_tornilleria.xlsx");
  const { createLlm } = await import('../src/lib/llm.ts');
  const { processMto } = await import('../src/pipeline/index.ts');
  const out = await processMto(createLlm(), file, { concurrency: 3, criticRouting: 'off' });
  const uncovered = out.gaps.filter((g) => g.kind === 'UNCOVERED_DERIVATION');
  console.log(`\n${file}: ${uncovered.length} calidades sin cubrir\n`);
  for (const g of uncovered) {
    console.log(`  fila ${g.rowRef}: ${g.value}`);
    console.log(`     ${g.detail}`);
  }
  if (!uncovered.length) console.log('  Todas las calidades del fichero están cubiertas por la tabla.');
}

const commands: Record<string, () => void | Promise<void>> = { list, test, add, retire, log, gaps };
const run = commands[cmd];
if (!run) {
  console.log(`\nSubcomandos: ${Object.keys(commands).join(' · ')}\n`);
  console.log('  npm run vocab                              la tabla, con quién decidió cada entrada');
  console.log("  npm run vocab -- test --quality='45H'      qué haría con una calidad, y por qué");
  console.log('  npm run vocab -- add --id=... ...          añadir una entrada (pide el argumento)');
  console.log("  npm run vocab -- retire --id=... ...       retirar una, con su motivo");
  console.log('  npm run vocab -- log                       el histórico de decisiones');
  console.log('  npm run vocab -- gaps --file=x.xlsx        qué calidades de un MTO no sabe derivar');
  process.exit(1);
}
await run();

/**
 * El vocabulario de derivación de material, en SQLite: **tabla cerrada, trazable y ampliable**.
 *
 * Es la respuesta a la pregunta Q3 del correo al cliente, implementada tal como se contestó:
 *
 *   > ¿Puede considerarse resuelta una línea si derivamos el material mediante una tabla cerrada y
 *   > trazable (A4-70 → INOX, 8.8 → AC), o debe ir a revisión?
 *   >
 *   > Default: derivar únicamente equivalencias deterministas conocidas, marcadas como derivadas.
 *   > Cualquier calidad **no cubierta o no unívoca** irá a revisión.
 *
 * Las tres palabras de esa frase son los tres requisitos de este módulo, y cada una es una decisión
 * de diseño concreta:
 *
 * **CERRADA.** Sólo deriva lo que hay en la tabla. Una calidad que no case NO sale con material
 * vacío: sale como hueco de política con su entrada candidata ya redactada. Y "no unívoca" cuenta
 * como no cubierta — ver `deriveMaterial`, que es lo que la versión anterior no hacía.
 *
 * **TRAZABLE.** Cada entrada lleva quién la decidió, cuándo, con qué argumento y sobre qué fuente. Y
 * el histórico de cambios es **la fuente de la verdad**, no un extra: `material-derivation.log.jsonl`
 * va en git y la base de datos es una vista materializada de él. Así el historial de decisiones es el
 * historial de git —legible, diffable, revisable— y la base se puede reconstruir entera desde cero.
 * Es el mismo principio append-only de los ADR: una decisión no se reescribe, se retira con su
 * motivo.
 *
 * **AMPLIABLE.** `addEntry` y `retireEntry` escriben en el log y la base se pone al día. El cliente
 * no tiene que tocar código ni esperar un despliegue: es el bucle de aprendizaje de
 * `docs/12-system-behind-the-rules.md` §4, cerrado.
 *
 * Por qué SQLite y no seguir con el JSON: porque "ampliable" y "consultable" no son lo mismo que
 * "legible". Con la tabla en una base se puede preguntar *qué entrada resolvió esta línea*, *qué
 * entradas ha añadido el cliente este mes* o *qué calidades siguen sin cubrir*, que es lo que hace
 * falta para que la tasa de huecos sea una métrica de producto y no una anécdota. `node:sqlite` viene
 * en Node 26, así que no añade ninguna dependencia.
 */

import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeQuality } from './quality.ts';

export type Material = 'AC' | 'INOX';
export type MatchKind = 'qualityGroup' | 'qualityPattern';

export interface VocabRow {
  id: string;
  matchKind: MatchKind;
  matchValue: string;
  material: Material;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  source: string;
  retiredAt: string | null;
  retiredWhy: string | null;
}

export interface UncoveredRow {
  matchKind: MatchKind;
  matchValue: string;
  why: string;
}

/** Una entrada del histórico. Append-only: describe un cambio, nunca el estado. */
export interface ChangeRow {
  seq: number;
  at: string;
  action: 'seed' | 'add' | 'retire';
  entryId: string;
  by: string;
  detail: string;
}

const SEED_PATH = join('data', 'vocabulary', 'material-derivation.json');
const LOG_PATH = join('data', 'vocabulary', 'material-derivation.log.jsonl');
const DB_PATH = join('data', 'vocabulary', 'material-derivation.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entry (
  id          TEXT PRIMARY KEY,
  match_kind  TEXT NOT NULL CHECK (match_kind IN ('qualityGroup','qualityPattern')),
  match_value TEXT NOT NULL,
  material    TEXT NOT NULL CHECK (material IN ('AC','INOX')),
  rationale   TEXT NOT NULL,
  decided_by  TEXT NOT NULL,
  decided_at  TEXT NOT NULL,
  source      TEXT NOT NULL,
  retired_at  TEXT,
  retired_why TEXT
);

-- Las calidades que a propósito NO llevan material derivable, con su motivo. Estar aquí es una
-- decisión tomada, no una laguna: una arandela 200HV puede ser acero o inoxidable, y derivar sería
-- inventar. Se distingue de "no cubierta" porque no genera hueco.
CREATE TABLE IF NOT EXISTS uncovered (
  match_kind  TEXT NOT NULL,
  match_value TEXT NOT NULL,
  why         TEXT NOT NULL,
  PRIMARY KEY (match_kind, match_value)
);

CREATE TABLE IF NOT EXISTS change (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL,
  action   TEXT NOT NULL CHECK (action IN ('seed','add','retire')),
  entry_id TEXT NOT NULL,
  by       TEXT NOT NULL,
  detail   TEXT NOT NULL
);
`;

interface SeedFile {
  version: number;
  policy: string;
  entries: {
    id: string;
    when: { qualityGroup?: string; qualityPattern?: string };
    material: Material;
    rationale: string;
    decidedBy: string;
    decidedAt: string;
    source: string;
  }[];
  deliberatelyUncovered?: { match: string; why: string }[];
}

/** Un evento del log. Es la fuente de la verdad; la base es una vista de esto. */
type LogEvent =
  | { action: 'add'; at: string; by: string; entry: Omit<VocabRow, 'retiredAt' | 'retiredWhy'>; detail: string }
  | { action: 'retire'; at: string; by: string; entryId: string; detail: string };

let db: DatabaseSync | null = null;

/**
 * Abre la base y la deja al día: esquema, semilla y log aplicado.
 *
 * Reconstruir desde la semilla y el log en cada apertura es a propósito: hace imposible que la base
 * y el historial se separen, y convierte "he perdido el .sqlite" en un no-problema. Con doce entradas
 * cuesta microsegundos; si algún día costara, sería porque el cliente ha tomado tantas decisiones que
 * ya no es un case técnico.
 */
export function openVocabularyDb(opts: { dbPath?: string; seedPath?: string; logPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.VOCAB_DB ?? DB_PATH;
  const seedPath = opts.seedPath ?? process.env.VOCAB_MATERIAL ?? SEED_PATH;
  const logPath = opts.logPath ?? process.env.VOCAB_LOG ?? LOG_PATH;

  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  // Dos procesos pueden abrir esta base a la vez —el front y una ejecución de `pnpm run vocab`, o dos
  // ficheros de test en paralelo— y `BEGIN IMMEDIATE` sin esto devuelve SQLITE_BUSY al instante. WAL
  // deja leer mientras otro escribe, que es el caso normal: se consulta mucho más de lo que se decide.
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  seed(db, seedPath);
  applyLog(db, logPath);
  return db;
}

/** Cierra y olvida. Costura para los tests. */
export function closeVocabularyDb(): void {
  db?.close();
  db = null;
}

/**
 * Siembra la tabla desde el JSON, **todo o nada**.
 *
 * La transacción no es decorativa: la primera versión no la tenía y una ejecución interrumpida dejó
 * la base con 6 de las 12 entradas. Y como `change` ya contenía filas de semilla, la comprobación de
 * "¿está sembrada?" decía que sí y no volvía a entrar nunca: la mitad de las calidades del catálogo
 * dejaron de derivar **en silencio**, que es el modo de fallo que este módulo entero existe para
 * eliminar. Lo detectaron tres tests, no un humano.
 *
 * De ahí también la comprobación por CUENTA en lugar de por existencia: una base a medio sembrar es
 * un estado que hay que poder reparar solo, no un estado en el que quedarse.
 */
function seed(conn: DatabaseSync, seedPath: string): void {
  if (!existsSync(seedPath)) return;
  const file = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedFile;
  const expected = file.entries.length;
  const have = conn.prepare(`SELECT COUNT(*) AS n FROM entry`).get() as { n: number };
  if (have.n >= expected) return;

  conn.exec('BEGIN IMMEDIATE');
  try {
    const insert = conn.prepare(`
      INSERT OR REPLACE INTO entry (id, match_kind, match_value, material, rationale, decided_by, decided_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const logIt = conn.prepare(
      `INSERT INTO change (at, action, entry_id, by, detail)
       SELECT ?, 'seed', ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM change WHERE action = 'seed' AND entry_id = ?)`);

    for (const e of file.entries) {
      const kind: MatchKind = e.when.qualityGroup ? 'qualityGroup' : 'qualityPattern';
      const value = e.when.qualityGroup ?? e.when.qualityPattern ?? '';
      insert.run(e.id, kind, value, e.material, e.rationale, e.decidedBy, e.decidedAt, e.source);
      logIt.run(e.decidedAt, e.id, e.decidedBy, `semilla desde ${seedPath}`, e.id);
    }

    // Las HV, que el JSON declara en prosa, aquí son filas consultables.
    const unc = conn.prepare(`INSERT OR REPLACE INTO uncovered (match_kind, match_value, why) VALUES (?, ?, ?)`);
    const why = file.deliberatelyUncovered?.[0]?.why
      ?? 'Dureza HV: describe el tratamiento superficial, no el metal base. Derivar sería inventar.';
    for (const g of ['G10', 'G11', 'G12', 'G13', 'G14']) unc.run('qualityGroup', g, why);

    conn.exec('COMMIT');
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  }
}

function applyLog(conn: DatabaseSync, logPath: string): void {
  if (!existsSync(logPath)) return;
  const applied = new Set(
    (conn.prepare(`SELECT entry_id, action, at FROM change WHERE action != 'seed'`).all() as
      { entry_id: string; action: string; at: string }[])
      .map((r) => `${r.action}|${r.entry_id}|${r.at}`),
  );

  const events = readFileSync(logPath, 'utf8').split('\n').filter((l) => l.trim());
  if (events.length === 0) return;

  // Igual que la semilla: el log se aplica entero o no se aplica.
  conn.exec('BEGIN IMMEDIATE');
  try {
  for (const raw of events) {
    const ev = JSON.parse(raw) as LogEvent;
    const key = `${ev.action}|${ev.action === 'add' ? ev.entry.id : ev.entryId}|${ev.at}`;
    if (applied.has(key)) continue;

    if (ev.action === 'add') {
      conn.prepare(`
        INSERT OR REPLACE INTO entry (id, match_kind, match_value, material, rationale, decided_by, decided_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(ev.entry.id, ev.entry.matchKind, ev.entry.matchValue, ev.entry.material,
             ev.entry.rationale, ev.entry.decidedBy, ev.entry.decidedAt, ev.entry.source);
    } else {
      conn.prepare(`UPDATE entry SET retired_at = ?, retired_why = ? WHERE id = ?`)
        .run(ev.at, ev.detail, ev.entryId);
    }
    conn.prepare(`INSERT INTO change (at, action, entry_id, by, detail) VALUES (?, ?, ?, ?, ?)`)
      .run(ev.at, ev.action, ev.action === 'add' ? ev.entry.id : ev.entryId, ev.by, ev.detail);
  }
    conn.exec('COMMIT');
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

const toRow = (r: Record<string, unknown>): VocabRow => ({
  id: r.id as string,
  matchKind: r.match_kind as MatchKind,
  matchValue: r.match_value as string,
  material: r.material as Material,
  rationale: r.rationale as string,
  decidedBy: r.decided_by as string,
  decidedAt: r.decided_at as string,
  source: r.source as string,
  retiredAt: (r.retired_at as string | null) ?? null,
  retiredWhy: (r.retired_why as string | null) ?? null,
});

/** Las entradas vivas, en orden de decisión. `includeRetired` para auditar. */
export function listEntries(opts: { includeRetired?: boolean } = {}): VocabRow[] {
  const conn = openVocabularyDb();
  const sql = opts.includeRetired
    ? `SELECT * FROM entry ORDER BY decided_at, id`
    : `SELECT * FROM entry WHERE retired_at IS NULL ORDER BY decided_at, id`;
  return (conn.prepare(sql).all() as Record<string, unknown>[]).map(toRow);
}

export function listUncovered(): UncoveredRow[] {
  const conn = openVocabularyDb();
  return (conn.prepare(`SELECT * FROM uncovered ORDER BY match_value`).all() as Record<string, unknown>[])
    .map((r) => ({ matchKind: r.match_kind as MatchKind, matchValue: r.match_value as string, why: r.why as string }));
}

export function listChanges(limit = 100): ChangeRow[] {
  const conn = openVocabularyDb();
  return (conn.prepare(`SELECT * FROM change ORDER BY seq DESC LIMIT ?`).all(limit) as Record<string, unknown>[])
    .map((r) => ({
      seq: r.seq as number, at: r.at as string, action: r.action as ChangeRow['action'],
      entryId: r.entry_id as string, by: r.by as string, detail: r.detail as string,
    }));
}

// ---------------------------------------------------------------------------
// Derivación
// ---------------------------------------------------------------------------

export interface Derivation {
  material: Material;
  entryId: string;
  rule: string;
  rationale: string;
  decidedBy: string;
}

/** Por qué una calidad no derivó. Las tres razones son distintas y el pipeline las trata distinto. */
export type NoDerivation =
  /** Ninguna entrada la cubre: hueco de política, con entrada candidata. */
  | { reason: 'uncovered' }
  /** Declarada no derivable a propósito, con su motivo. NO es un hueco. */
  | { reason: 'deliberate'; why: string }
  /** Dos entradas la cubren con materiales distintos. A revisión: la tabla debe una desambiguación. */
  | { reason: 'ambiguous'; candidates: { entryId: string; material: Material }[] };

/**
 * Deriva el material de una calidad contra la tabla cerrada.
 *
 * **La ambigüedad no se resuelve, se reporta.** La versión anterior devolvía la primera entrada que
 * casaba, así que dos entradas en conflicto se decidían por el orden del fichero — un default
 * disparándose en silencio, que es justo lo que este vocabulario existe para eliminar. Hoy no puede
 * pasar con las doce entradas (los grupos son disjuntos y los patrones ASTM no se solapan), y "hoy no
 * puede pasar" es exactamente la garantía que se rompe en cuanto el cliente añada la entrada número
 * trece.
 */
export function deriveMaterial(rawQuality: string): Derivation | NoDerivation {
  const q = normalizeQuality(rawQuality);
  const folded = rawQuality.toUpperCase().replace(/\s+/g, ' ').trim();

  const deliberate = listUncovered().find(
    (u) => u.matchKind === 'qualityGroup' && q.group !== null && u.matchValue === q.group,
  );
  if (deliberate) return { reason: 'deliberate', why: deliberate.why };

  const matches = listEntries().filter((e) =>
    e.matchKind === 'qualityGroup'
      ? q.group !== null && e.matchValue === q.group
      : new RegExp(e.matchValue, 'i').test(folded));

  if (matches.length === 0) return { reason: 'uncovered' };

  const materials = new Set(matches.map((m) => m.material));
  if (materials.size > 1) {
    return { reason: 'ambiguous', candidates: matches.map((m) => ({ entryId: m.id, material: m.material })) };
  }

  const e = matches[0];
  return {
    material: e.material,
    entryId: e.id,
    rule: `P-3:${e.id}`,
    rationale: e.rationale,
    decidedBy: e.decidedBy,
  };
}

export const isDerived = (r: Derivation | NoDerivation): r is Derivation => 'material' in r;

// ---------------------------------------------------------------------------
// Escritura · el bucle de aprendizaje
// ---------------------------------------------------------------------------

export interface NewEntry {
  id: string;
  matchKind: MatchKind;
  matchValue: string;
  material: Material;
  rationale: string;
  decidedBy: string;
  source: string;
}

/**
 * Añade una entrada. Escribe primero en el log —que es la fuente— y luego en la base.
 *
 * Rechaza lo que rompería la promesa de la tabla, antes de escribir nada:
 *   - un id repetido, porque el id es lo que aparece en la traza de una línea comprada;
 *   - una entrada que haría ambigua una calidad que hoy resuelve, porque eso convierte líneas
 *     resueltas en revisiones sin que nadie lo haya pedido.
 */
export function addEntry(e: NewEntry, at: string, logPath = process.env.VOCAB_LOG ?? LOG_PATH): void {
  const conn = openVocabularyDb();
  const exists = conn.prepare(`SELECT id FROM entry WHERE id = ?`).get(e.id);
  if (exists) throw new Error(`Ya existe una entrada con id '${e.id}'. Los ids son la traza de una compra: no se reutilizan.`);

  const clash = listEntries().find(
    (x) => x.matchKind === e.matchKind && x.matchValue === e.matchValue && x.material !== e.material,
  );
  if (clash) {
    throw new Error(
      `'${e.matchValue}' ya deriva a ${clash.material} por la entrada '${clash.id}'. ` +
      `Añadir ${e.material} la haría ambigua y mandaría a revisión todas sus líneas. ` +
      `Retira '${clash.id}' con su motivo si la decisión ha cambiado.`,
    );
  }

  const ev: LogEvent = {
    action: 'add', at, by: e.decidedBy, detail: e.rationale,
    entry: { ...e, decidedAt: at },
  };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(ev)}\n`, 'utf8');
  applyLog(conn, logPath);
}

/** Retira una entrada. No se borra: el histórico es el argumento de por qué se compró lo que se compró. */
export function retireEntry(id: string, why: string, by: string, at: string, logPath = process.env.VOCAB_LOG ?? LOG_PATH): void {
  const conn = openVocabularyDb();
  const row = conn.prepare(`SELECT id, retired_at FROM entry WHERE id = ?`).get(id) as { id: string; retired_at: string | null } | undefined;
  if (!row) throw new Error(`No existe la entrada '${id}'.`);
  if (row.retired_at) throw new Error(`La entrada '${id}' ya se retiró el ${row.retired_at}.`);

  const ev: LogEvent = { action: 'retire', at, by, entryId: id, detail: why };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(ev)}\n`, 'utf8');
  applyLog(conn, logPath);
}

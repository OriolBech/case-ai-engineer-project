/**
 * Vocabulario de calidad — la capa 2 de §5. Ver specs/SPEC-017-quality-vocabulary.md.
 *
 * La capa 1 (`quality.ts`) es el documento del cliente: los 23 valores y los 14 grupos de
 * equivalencia, en código y de solo lectura. Esta capa es la que el cliente EXTIENDE desde el
 * front: una entrada casa un token de calidad que §5 no lista (un `45H`, un `GR 12H`, la grafía de
 * un estudio nuevo) con uno de los 14 grupos.
 *
 * Por qué es la última en llegar y la más delicada (docs/07-target-solution.md, línea 5): dar de
 * alta aquí no es normalizar una grafía, es **declarar dos calidades intercambiables**. Por eso la
 * guarda de contradicción con la capa 1 existe desde el primer día: mapear a otro grupo un valor que
 * §5 ya lista es reescribir el documento del cliente, y eso no puede ni guardarse sin aviso.
 *
 * Mismos principios que `finish-db.ts` y `vocabulary-db.ts`: el log JSONL es la fuente de la verdad
 * (va en git), el SQLite es una vista materializada que se reconstruye en cada apertura, y un id no
 * se reutiliza jamás — es la traza de una compra.
 *
 * Lo que NO hace: escanear texto libre. §5 es explícita —si no se sabe si un valor está marcado
 * como calidad, no se extrae— así que la resolución es por coincidencia EXACTA sobre el token que el
 * extractor ya aisló. Sin escaneo no hay límite de palabra que vigilar.
 */

import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fold } from './text.ts';
import { QUALITY_GROUPS, normalizeQuality, type QualityResult } from './quality.ts';
import type { QualityGroup } from '../pipeline/types.ts';
import { loadGold } from '../eval/harness.ts';

export interface QualityAliasRow {
  id: string;
  /** El token tal como lo escribe el estudio (`45H`, `GR 12H`). */
  alias: string;
  /** El grupo de §5 al que se declara equivalente. */
  group: QualityGroup;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  evidence: string;
  retiredAt: string | null;
  retiredWhy: string | null;
}

export interface NewQualityAlias {
  id: string;
  alias: string;
  group: QualityGroup;
  rationale: string;
  decidedBy: string;
  evidence: string;
}

export interface ChangeRow {
  seq: number;
  at: string;
  action: 'seed' | 'add' | 'retire';
  entryId: string;
  by: string;
  detail: string;
}

const SEED_PATH = join('data', 'vocabulary', 'quality-alias.json');
const LOG_PATH = join('data', 'vocabulary', 'quality-alias.log.jsonl');
const DB_PATH = join('data', 'vocabulary', 'quality-alias.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entry (
  id          TEXT PRIMARY KEY,
  alias       TEXT NOT NULL,
  quality_group TEXT NOT NULL,
  rationale   TEXT NOT NULL,
  decided_by  TEXT NOT NULL,
  decided_at  TEXT NOT NULL,
  evidence    TEXT NOT NULL,
  retired_at  TEXT,
  retired_why TEXT
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
  attribute: string;
  entries: {
    id: string;
    alias: string;
    group: QualityGroup;
    rationale: string;
    decidedBy: string;
    decidedAt: string;
    evidence: string;
  }[];
}

type LogEvent =
  | { action: 'add'; at: string; by: string; entry: Omit<QualityAliasRow, 'retiredAt' | 'retiredWhy'>; detail: string }
  | { action: 'retire'; at: string; by: string; entryId: string; detail: string };

let db: DatabaseSync | null = null;

export function openQualityDb(opts: { dbPath?: string; seedPath?: string; logPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.VOCAB_QUALITY_DB ?? DB_PATH;
  const seedPath = opts.seedPath ?? process.env.VOCAB_QUALITY ?? SEED_PATH;
  const logPath = opts.logPath ?? process.env.VOCAB_QUALITY_LOG ?? LOG_PATH;

  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  seed(db, seedPath);
  applyLog(db, logPath);
  return db;
}

/** Cierra y olvida. Costura para los tests. */
export function closeQualityDb(): void {
  db?.close();
  db = null;
}

function seed(conn: DatabaseSync, seedPath: string): void {
  if (!existsSync(seedPath)) return;
  const file = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedFile;
  const expected = file.entries.length;
  const have = conn.prepare(`SELECT COUNT(*) AS n FROM entry`).get() as { n: number };
  if (have.n >= expected) return;

  conn.exec('BEGIN IMMEDIATE');
  try {
    const insert = conn.prepare(`
      INSERT OR REPLACE INTO entry (id, alias, quality_group, rationale, decided_by, decided_at, evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const logIt = conn.prepare(
      `INSERT INTO change (at, action, entry_id, by, detail)
       SELECT ?, 'seed', ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM change WHERE action = 'seed' AND entry_id = ?)`);

    for (const e of file.entries) {
      insert.run(e.id, e.alias, e.group, e.rationale, e.decidedBy, e.decidedAt, e.evidence);
      logIt.run(e.decidedAt, e.id, e.decidedBy, `semilla desde ${seedPath}`, e.id);
    }
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

  conn.exec('BEGIN IMMEDIATE');
  try {
    for (const raw of events) {
      const ev = JSON.parse(raw) as LogEvent;
      const key = `${ev.action}|${ev.action === 'add' ? ev.entry.id : ev.entryId}|${ev.at}`;
      if (applied.has(key)) continue;

      if (ev.action === 'add') {
        conn.prepare(`
          INSERT OR REPLACE INTO entry (id, alias, quality_group, rationale, decided_by, decided_at, evidence)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(
            ev.entry.id, ev.entry.alias, ev.entry.group, ev.entry.rationale,
            ev.entry.decidedBy, ev.entry.decidedAt, ev.entry.evidence,
          );
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

const toRow = (r: Record<string, unknown>): QualityAliasRow => ({
  id: r.id as string,
  alias: r.alias as string,
  group: r.quality_group as QualityGroup,
  rationale: r.rationale as string,
  decidedBy: r.decided_by as string,
  decidedAt: r.decided_at as string,
  evidence: r.evidence as string,
  retiredAt: (r.retired_at as string | null) ?? null,
  retiredWhy: (r.retired_why as string | null) ?? null,
});

export function listEntries(opts: { includeRetired?: boolean } = {}): QualityAliasRow[] {
  const conn = openQualityDb();
  const sql = opts.includeRetired
    ? `SELECT * FROM entry ORDER BY decided_at, id`
    : `SELECT * FROM entry WHERE retired_at IS NULL ORDER BY decided_at, id`;
  return (conn.prepare(sql).all() as Record<string, unknown>[]).map(toRow);
}

export function listChanges(limit = 100): ChangeRow[] {
  const conn = openQualityDb();
  return (conn.prepare(`SELECT * FROM change ORDER BY seq DESC LIMIT ?`).all(limit) as Record<string, unknown>[])
    .map((r) => ({
      seq: r.seq as number, at: r.at as string, action: r.action as ChangeRow['action'],
      entryId: r.entry_id as string, by: r.by as string, detail: r.detail as string,
    }));
}

// ---------------------------------------------------------------------------
// Resolución
// ---------------------------------------------------------------------------

export type QualitySource = 'catalog' | 'vocab' | 'ambiguous' | 'out';

export interface QualityResolution extends QualityResult {
  /** Quién la conoce: §5 (catalog), la capa 2 (vocab), dos entradas a la vez (ambiguous) o nadie. */
  source: QualitySource;
  /** Entrada de capa 2 que resolvió, si fue ella. */
  entryId: string | null;
  /** Candidatas en conflicto, si es ambigua. La tabla debe una desambiguación. */
  candidates?: { entryId: string; group: QualityGroup }[];
}

function resolveWithEntries(raw: string, live: QualityAliasRow[]): QualityResolution {
  const layer1 = normalizeQuality(raw);
  if (layer1.inCatalog) return { ...layer1, source: 'catalog', entryId: null };

  const needle = fold(raw);
  const hits = live.filter((e) => fold(e.alias) === needle);
  if (hits.length === 0) return { ...layer1, source: 'out', entryId: null };

  const groups = new Set(hits.map((h) => h.group));
  if (groups.size > 1) {
    return {
      ...layer1,
      source: 'ambiguous',
      entryId: null,
      candidates: hits.map((h) => ({ entryId: h.id, group: h.group })),
    };
  }
  return { ...layer1, group: hits[0].group, source: 'vocab', entryId: hits[0].id };
}

/**
 * La calidad contra las DOS capas: primero §5, después el vocabulario editable. La salida es un
 * `QualityResult` más quién la conoció, así que `checkCoherence` y la derivación de material (que
 * miran `group`) no necesitan saber de qué capa salió.
 *
 * En ambigua NO se elige un grupo: el grupo queda null y la cobertura lo reporta, porque la tabla
 * debe una desambiguación, no una coinflip.
 */
export function resolveQuality(raw: string): QualityResolution {
  return resolveWithEntries(raw, listEntries());
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface AddQualityOptions {
  /**
   * Guarda de política que dispararía → aviso en vez de excepción, y el alta se escribe igual.
   * Igual que en acabado: la política de bloqueo vive en quien llama (para la demo, no se bloquea).
   */
  force?: boolean;
  skipGoldCheck?: boolean;
}

/** Invariantes duros: una entrada que los rompe no puede existir, ni con `force`. */
function assertStructural(e: NewQualityAlias): void {
  if (!e.alias.trim()) throw new Error('Falta el token de calidad que dispara la entrada.');
  if (!QUALITY_GROUPS.has(e.group)) {
    throw new Error(
      `El grupo '${e.group}' no es uno de los 14 de §5. Declarar un grupo nuevo es cambiar el ` +
      'documento del cliente: se hace en la capa 1, no desde aquí.',
    );
  }
}

/**
 * Las guardas, como lista de avisos en vez de excepción (mismo patrón que acabado):
 *
 * 1. **Contradicción con §5.** El token ya es un valor del catálogo del cliente de OTRO grupo.
 *    Eso no es un alias: es reescribir su documento (un `A4-80` → G2 lo convertiría en equivalente
 *    a `A2-80`, y el invariante del sistema es no convertir entre grupos jamás).
 * 2. **Conflicto con la capa 2.** El mismo token ya lleva a otro grupo por una entrada viva:
 *    añadirlo la haría ambigua y mandaría a revisión todas sus líneas.
 * 3. **Regresión del gold.** Una alta no puede cambiar la lectura de una celda CIERTA del gold.
 */
function guardWarnings(
  e: NewQualityAlias,
  live: QualityAliasRow[],
  at: string,
  opts: AddQualityOptions,
): string[] {
  const w: string[] = [];

  const layer1 = normalizeQuality(e.alias);
  if (layer1.inCatalog && layer1.group !== e.group) {
    w.push(
      `'${e.alias}' ya es un valor de §5 (${layer1.canonical}, grupo ${layer1.group}). ` +
      `Declararlo ${e.group} contradice el documento del cliente: no es un alias, es un cambio de ` +
      'equivalencias, y eso se decide con él, no desde un formulario.',
    );
  } else if (layer1.inCatalog) {
    w.push(`'${e.alias}' ya está en §5 (${layer1.group}): la entrada es redundante.`);
  }

  const clash = live.find((x) => fold(x.alias) === fold(e.alias) && x.group !== e.group);
  if (clash) {
    w.push(
      `'${e.alias}' ya lleva a ${clash.group} por la entrada '${clash.id}'. Añadir ${e.group} la ` +
      `haría ambigua y mandaría a revisión todas sus líneas. Retira '${clash.id}' con su motivo si ` +
      'la decisión ha cambiado.',
    );
  }

  if (!opts.skipGoldCheck) {
    const simulated: QualityAliasRow[] = [
      ...live,
      { ...e, decidedAt: at, retiredAt: null, retiredWhy: null },
    ];
    for (const line of loadGold()) {
      const cell = line.attributes.quality;
      if (!cell || cell.certainty !== 'C') continue;
      const sample = cell.value;
      if (sample === null || sample === undefined || String(sample).trim() === '') continue;
      const before = resolveWithEntries(String(sample), live);
      const after = resolveWithEntries(String(sample), simulated);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        w.push(
          `La entrada cambiaría la lectura de la calidad '${sample}' en el gold set. ` +
          'Una alta que rompe el gold set no se promueve.',
        );
        break;
      }
    }
  }
  return w;
}

export function addEntry(
  e: NewQualityAlias,
  at: string,
  logPath = process.env.VOCAB_QUALITY_LOG ?? LOG_PATH,
  opts: AddQualityOptions = {},
): { warnings: string[] } {
  const entry: NewQualityAlias = { ...e, alias: e.alias.trim() };
  assertStructural(entry);
  const conn = openQualityDb();
  const exists = conn.prepare(`SELECT id FROM entry WHERE id = ?`).get(entry.id);
  if (exists) {
    throw new Error(`Ya existe una entrada con id '${entry.id}'. Los ids son la traza de una compra: no se reutilizan.`);
  }

  const live = listEntries();
  const warnings = guardWarnings(entry, live, at, opts);
  // Ruta normal: la primera guarda corta el alta, con el mismo mensaje de siempre. Con `force`, no.
  if (warnings.length && !opts.force) throw new Error(warnings[0]);

  const ev: LogEvent = {
    action: 'add', at, by: entry.decidedBy, detail: entry.rationale,
    entry: { ...entry, decidedAt: at },
  };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(ev)}\n`, 'utf8');
  applyLog(conn, logPath);
  return { warnings };
}

/** Retira una entrada. No se borra: el histórico es el argumento de por qué se compró lo que se compró. */
export function retireEntry(
  id: string,
  why: string,
  by: string,
  at: string,
  logPath = process.env.VOCAB_QUALITY_LOG ?? LOG_PATH,
): void {
  const conn = openQualityDb();
  const row = conn.prepare(`SELECT id, retired_at FROM entry WHERE id = ?`).get(id) as
    { id: string; retired_at: string | null } | undefined;
  if (!row) throw new Error(`No existe la entrada '${id}'.`);
  if (row.retired_at) throw new Error(`La entrada '${id}' ya se retiró el ${row.retired_at}.`);

  const ev: LogEvent = { action: 'retire', at, by, entryId: id, detail: why };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(ev)}\n`, 'utf8');
  applyLog(conn, logPath);
}

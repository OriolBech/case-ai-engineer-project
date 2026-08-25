/**
 * Capa 2 de alias para nombre, calidad y norma.
 *
 * Las tablas en código siguen siendo la capa 1 del cliente y nunca se reescriben. Esta base sólo
 * contiene decisiones añadidas, con log JSONL append-only como fuente reconstruible.
 */
import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fold } from './text.ts';

export type GenericAliasAttribute = 'name' | 'quality' | 'standard';

export interface GenericAliasRow {
  id: string;
  attribute: GenericAliasAttribute;
  alias: string;
  value: string;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  evidence: string;
  retiredAt: string | null;
  retiredWhy: string | null;
}

export interface NewGenericAlias {
  id: string;
  attribute: GenericAliasAttribute;
  alias: string;
  value: string;
  rationale: string;
  decidedBy: string;
  evidence: string;
}

export interface GenericAliasHit {
  row: GenericAliasRow;
  span: { start: number; end: number };
}

type LogEvent =
  | {
      action: 'add';
      at: string;
      by: string;
      entry: Omit<GenericAliasRow, 'retiredAt' | 'retiredWhy'>;
      detail: string;
    }
  | { action: 'retire'; at: string; by: string; entryId: string; detail: string };

const DB_PATH = join('data', 'vocabulary', 'generic-alias.sqlite');
const LOG_PATH = join('data', 'vocabulary', 'generic-alias.log.jsonl');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entry (
  id          TEXT PRIMARY KEY,
  attribute   TEXT NOT NULL CHECK (attribute IN ('name','quality','standard')),
  alias       TEXT NOT NULL,
  value       TEXT NOT NULL,
  rationale   TEXT NOT NULL,
  decided_by  TEXT NOT NULL,
  decided_at  TEXT NOT NULL,
  evidence    TEXT NOT NULL,
  retired_at  TEXT,
  retired_why TEXT
);

CREATE INDEX IF NOT EXISTS idx_generic_alias_attr
  ON entry(attribute, retired_at);

CREATE TABLE IF NOT EXISTS change (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL,
  action   TEXT NOT NULL CHECK (action IN ('add','retire')),
  entry_id TEXT NOT NULL,
  by       TEXT NOT NULL,
  detail   TEXT NOT NULL
);
`;

let db: DatabaseSync | null = null;

export function openGenericAliasDb(
  opts: { dbPath?: string; logPath?: string } = {},
): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.VOCAB_GENERIC_DB ?? DB_PATH;
  const logPath = opts.logPath ?? process.env.VOCAB_GENERIC_LOG ?? LOG_PATH;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  applyLog(db, logPath);
  return db;
}

export function closeGenericAliasDb(): void {
  db?.close();
  db = null;
}

function applyLog(conn: DatabaseSync, logPath: string): void {
  if (!existsSync(logPath)) return;
  const applied = new Set(
    (
      conn.prepare(`SELECT entry_id, action, at FROM change`).all() as {
        entry_id: string;
        action: string;
        at: string;
      }[]
    ).map((r) => `${r.action}|${r.entry_id}|${r.at}`),
  );
  const events = readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim());
  if (events.length === 0) return;

  conn.exec('BEGIN IMMEDIATE');
  try {
    for (const raw of events) {
      const event = JSON.parse(raw) as LogEvent;
      const entryId = event.action === 'add' ? event.entry.id : event.entryId;
      if (applied.has(`${event.action}|${entryId}|${event.at}`)) continue;
      if (event.action === 'add') {
        conn
          .prepare(
            `INSERT INTO entry (
              id, attribute, alias, value, rationale, decided_by, decided_at, evidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            event.entry.id,
            event.entry.attribute,
            event.entry.alias,
            event.entry.value,
            event.entry.rationale,
            event.entry.decidedBy,
            event.entry.decidedAt,
            event.entry.evidence,
          );
      } else {
        conn
          .prepare(`UPDATE entry SET retired_at = ?, retired_why = ? WHERE id = ?`)
          .run(event.at, event.detail, event.entryId);
      }
      conn
        .prepare(`INSERT INTO change (at, action, entry_id, by, detail) VALUES (?, ?, ?, ?, ?)`)
        .run(event.at, event.action, entryId, event.by, event.detail);
    }
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

const toRow = (r: Record<string, unknown>): GenericAliasRow => ({
  id: r.id as string,
  attribute: r.attribute as GenericAliasAttribute,
  alias: r.alias as string,
  value: r.value as string,
  rationale: r.rationale as string,
  decidedBy: r.decided_by as string,
  decidedAt: r.decided_at as string,
  evidence: r.evidence as string,
  retiredAt: (r.retired_at as string | null) ?? null,
  retiredWhy: (r.retired_why as string | null) ?? null,
});

export function listGenericAliases(
  opts: { attribute?: GenericAliasAttribute; includeRetired?: boolean } = {},
): GenericAliasRow[] {
  const where: string[] = [];
  const args: string[] = [];
  if (opts.attribute) {
    where.push('attribute = ?');
    args.push(opts.attribute);
  }
  if (!opts.includeRetired) where.push('retired_at IS NULL');
  const sql = `SELECT * FROM entry${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY decided_at, id`;
  return (
    openGenericAliasDb().prepare(sql).all(...args) as Record<string, unknown>[]
  ).map(toRow);
}

export function resolveGenericAlias(
  attribute: GenericAliasAttribute,
  raw: string,
): GenericAliasRow | null {
  const needle = fold(raw);
  return (
    listGenericAliases({ attribute }).find((row) => fold(row.alias) === needle) ?? null
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findGenericAliases(
  attribute: GenericAliasAttribute,
  text: string,
): GenericAliasHit[] {
  const folded = fold(text);
  const rows = [...listGenericAliases({ attribute })].sort(
    (a, b) => fold(b.alias).length - fold(a.alias).length,
  );
  const claimed = new Array(folded.length).fill(false);
  const hits: GenericAliasHit[] = [];
  for (const row of rows) {
    const needle = fold(row.alias);
    const re = new RegExp(`(?<![A-Z0-9])${escapeRe(needle)}(?![A-Z0-9])`, 'g');
    for (let match = re.exec(folded); match; match = re.exec(folded)) {
      const start = match.index;
      const end = start + needle.length;
      if (claimed.slice(start, end).some(Boolean)) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      hits.push({ row, span: { start, end } });
    }
  }
  return hits.sort((a, b) => a.span.start - b.span.start);
}

export function addGenericAlias(
  input: NewGenericAlias,
  at: string,
  logPath = process.env.VOCAB_GENERIC_LOG ?? LOG_PATH,
): void {
  const entry = {
    ...input,
    alias: input.alias.trim(),
    value: input.value.trim(),
    decidedBy: input.decidedBy.trim(),
  };
  if (!entry.alias) throw new Error('Falta el alias a promover.');
  if (!entry.value) throw new Error('Falta el valor canónico del alias.');
  if (!entry.decidedBy) throw new Error('Falta el actor que decide el alias.');

  const conn = openGenericAliasDb();
  if (conn.prepare(`SELECT id FROM entry WHERE id = ?`).get(entry.id)) {
    throw new Error(`Ya existe una entrada con id '${entry.id}'.`);
  }
  const clash = listGenericAliases({ attribute: entry.attribute }).find(
    (row) => fold(row.alias) === fold(entry.alias),
  );
  if (clash) {
    throw new Error(
      `'${entry.alias}' ya resuelve a ${clash.value} por '${clash.id}'. ` +
        'Retira la decisión anterior antes de cambiarla.',
    );
  }

  const event: LogEvent = {
    action: 'add',
    at,
    by: entry.decidedBy,
    detail: entry.rationale,
    entry: { ...entry, decidedAt: at },
  };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(event)}\n`, 'utf8');
  applyLog(conn, logPath);
}

export function retireGenericAlias(
  id: string,
  why: string,
  by: string,
  at: string,
  logPath = process.env.VOCAB_GENERIC_LOG ?? LOG_PATH,
): void {
  const conn = openGenericAliasDb();
  const row = conn.prepare(`SELECT retired_at FROM entry WHERE id = ?`).get(id) as
    | { retired_at: string | null }
    | undefined;
  if (!row) throw new Error(`No existe la entrada '${id}'.`);
  if (row.retired_at) throw new Error(`La entrada '${id}' ya se retiró el ${row.retired_at}.`);
  const event: LogEvent = { action: 'retire', at, by, entryId: id, detail: why };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(event)}\n`, 'utf8');
  applyLog(conn, logPath);
}

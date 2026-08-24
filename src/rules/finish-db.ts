/**
 * Vocabulario de acabado — tabla cerrada, trazable y ampliable. Ver specs/SPEC-011-finish-vocabulary.md.
 *
 * Mismo principio que `vocabulary-db.ts`: el log JSONL es la fuente de la verdad; SQLite es una vista
 * materializada que se reconstruye entera desde la semilla + el log en cada apertura.
 */

import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fold, type AliasSource } from './text.ts';
import type { Finish } from '../pipeline/types.ts';
import { loadGold } from '../eval/harness.ts';

export type { Finish };

export type FinishAliasKind = 'alias' | 'not_a_finish';

export const FINISH_CATALOG: readonly Finish[] = [
  'GEOMET',
  'DACROMET',
  'GALVANIZADO EN CALIENTE',
  'CINCADO',
  'PAVONADO',
  'FOSFATADO',
  'BICROMATADO',
] as const;

export interface FinishAliasRow {
  id: string;
  alias: string;
  kind: FinishAliasKind;
  finish: Finish | null;
  source: AliasSource;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  evidence: string;
  retiredAt: string | null;
  retiredWhy: string | null;
}

export interface NewFinishAlias {
  id: string;
  alias: string;
  kind: FinishAliasKind;
  finish: Finish | null;
  source: AliasSource;
  rationale: string;
  decidedBy: string;
  evidence: string;
}

export type FinishResolution =
  | { kind: 'known'; finish: Finish; entryId: string; rule: string; alias: string; aliasSource: AliasSource }
  | { kind: 'not_a_finish'; why: string; entryId: string }
  | { kind: 'unknown' }
  | { kind: 'ambiguous'; candidates: { entryId: string; finish: Finish | null; alias: string }[] };

export interface FinishHit {
  finish: Finish;
  alias: string;
  aliasSource: AliasSource;
  entryId: string;
  span: { start: number; end: number };
}

export interface ChangeRow {
  seq: number;
  at: string;
  action: 'seed' | 'add' | 'retire';
  entryId: string;
  by: string;
  detail: string;
}

export interface AddFinishOptions {
  allowShortAlias?: boolean;
  skipGoldCheck?: boolean;
  /**
   * Guarda de política que dispararía → aviso en vez de excepción, y el alta se escribe igual.
   * La decisión de bloquear o no es de quien llama (para la demo, no se bloquea). Los invariantes
   * duros (id repetido, alias sin acabado) NO se saltan ni con esto.
   */
  force?: boolean;
}

const SEED_PATH = join('data', 'vocabulary', 'finish-alias.json');
const LOG_PATH = join('data', 'vocabulary', 'finish-alias.log.jsonl');
const DB_PATH = join('data', 'vocabulary', 'finish-alias.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entry (
  id          TEXT PRIMARY KEY,
  alias       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('alias','not_a_finish')),
  finish      TEXT,
  source      TEXT NOT NULL CHECK (source IN ('client','added')),
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
  entries: {
    id: string;
    alias: string;
    kind: FinishAliasKind;
    finish: Finish | null;
    source: AliasSource;
    rationale: string;
    decidedBy: string;
    decidedAt: string;
    evidence: string;
  }[];
}

type LogEvent =
  | { action: 'add'; at: string; by: string; entry: Omit<FinishAliasRow, 'retiredAt' | 'retiredWhy'>; detail: string }
  | { action: 'retire'; at: string; by: string; entryId: string; detail: string };

let db: DatabaseSync | null = null;

export function openFinishDb(opts: { dbPath?: string; seedPath?: string; logPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.VOCAB_FINISH_DB ?? DB_PATH;
  const seedPath = opts.seedPath ?? process.env.VOCAB_FINISH ?? SEED_PATH;
  const logPath = opts.logPath ?? process.env.VOCAB_FINISH_LOG ?? LOG_PATH;

  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');

  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version < 2) {
    db.exec('DROP TABLE IF EXISTS entry');
    db.exec('DROP TABLE IF EXISTS change');
    db.exec('PRAGMA user_version = 2');
  }

  db.exec(SCHEMA);
  seed(db, seedPath);
  applyLog(db, logPath);
  return db;
}

export function closeFinishDb(): void {
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
      INSERT OR REPLACE INTO entry (id, alias, kind, finish, source, rationale, decided_by, decided_at, evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const logIt = conn.prepare(
      `INSERT INTO change (at, action, entry_id, by, detail)
       SELECT ?, 'seed', ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM change WHERE action = 'seed' AND entry_id = ?)`,
    );

    for (const e of file.entries) {
      insert.run(e.id, e.alias, e.kind, e.finish, e.source, e.rationale, e.decidedBy, e.decidedAt, e.evidence);
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
          INSERT OR REPLACE INTO entry (id, alias, kind, finish, source, rationale, decided_by, decided_at, evidence)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            ev.entry.id, ev.entry.alias, ev.entry.kind, ev.entry.finish, ev.entry.source,
            ev.entry.rationale, ev.entry.decidedBy, ev.entry.decidedAt, ev.entry.evidence,
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

const toRow = (r: Record<string, unknown>): FinishAliasRow => ({
  id: r.id as string,
  alias: r.alias as string,
  kind: r.kind as FinishAliasKind,
  finish: (r.finish as Finish | null) ?? null,
  source: r.source as AliasSource,
  rationale: r.rationale as string,
  decidedBy: r.decided_by as string,
  decidedAt: r.decided_at as string,
  evidence: r.evidence as string,
  retiredAt: (r.retired_at as string | null) ?? null,
  retiredWhy: (r.retired_why as string | null) ?? null,
});

export function listEntries(opts: { includeRetired?: boolean } = {}): FinishAliasRow[] {
  const conn = openFinishDb();
  const sql = opts.includeRetired
    ? `SELECT * FROM entry ORDER BY decided_at, id`
    : `SELECT * FROM entry WHERE retired_at IS NULL ORDER BY decided_at, id`;
  return (conn.prepare(sql).all() as Record<string, unknown>[]).map(toRow);
}

/** Los 7 de semilla §9 más acabados añadidos por compras (alias vivos distintos de la semilla), ordenados. */
export function listCatalog(): string[] {
  const seedSet = new Set<string>(FINISH_CATALOG);
  const extras = new Set<string>();
  for (const e of listEntries()) {
    if (e.kind === 'alias' && e.finish && !seedSet.has(e.finish)) extras.add(e.finish);
  }
  return [...FINISH_CATALOG, ...[...extras].sort()];
}

export function listChanges(limit = 100): ChangeRow[] {
  const conn = openFinishDb();
  return (conn.prepare(`SELECT * FROM change ORDER BY seq DESC LIMIT ?`).all(limit) as Record<string, unknown>[])
    .map((r) => ({
      seq: r.seq as number, at: r.at as string, action: r.action as ChangeRow['action'],
      entryId: r.entry_id as string, by: r.by as string, detail: r.detail as string,
    }));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface MatchCandidate {
  row: FinishAliasRow;
  span: { start: number; end: number };
}

function collectMatches(text: string, entries: FinishAliasRow[], mode: 'exact' | 'scan'): MatchCandidate[] {
  const folded = fold(text);
  const sorted = [...entries].sort((a, b) => fold(b.alias).length - fold(a.alias).length);
  const matches: MatchCandidate[] = [];

  if (mode === 'exact') {
    for (const row of sorted) {
      if (fold(row.alias) === folded) {
        matches.push({ row, span: { start: 0, end: text.length } });
      }
    }
    return matches;
  }

  const claimed = new Array(folded.length).fill(false);
  for (const row of sorted) {
    const needle = fold(row.alias);
    const re = new RegExp(`(?<![A-Z0-9])${escapeRe(needle)}(?![A-Z0-9])`, 'g');
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const start = m.index;
      const end = start + needle.length;
      let free = true;
      for (let i = start; i < end; i++) if (claimed[i]) { free = false; break; }
      if (!free) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      matches.push({ row, span: { start, end } });
    }
  }
  return matches.sort((a, b) => a.span.start - b.span.start);
}

function resolutionKey(row: FinishAliasRow): string {
  return row.kind === 'not_a_finish' ? 'not_a_finish' : `alias:${row.finish}`;
}

function toResolution(matches: MatchCandidate[]): FinishResolution {
  if (matches.length === 0) return { kind: 'unknown' };

  const keys = new Set(matches.map((m) => resolutionKey(m.row)));
  if (keys.size > 1) {
    return {
      kind: 'ambiguous',
      candidates: matches.map((m) => ({
        entryId: m.row.id,
        finish: m.row.finish,
        alias: m.row.alias,
      })),
    };
  }

  const best = matches[0].row;
  if (best.kind === 'not_a_finish') {
    return { kind: 'not_a_finish', why: best.rationale, entryId: best.id };
  }
  return {
    kind: 'known',
    finish: best.finish!,
    entryId: best.id,
    rule: `P-12:${best.id}`,
    alias: best.alias,
    aliasSource: best.source,
  };
}

function resolveWithEntries(rawOrText: string, entries: FinishAliasRow[]): FinishResolution {
  const exact = collectMatches(rawOrText, entries, 'exact');
  if (exact.length) return toResolution(exact);
  return toResolution(collectMatches(rawOrText, entries, 'scan'));
}

/** Sustituye a `normalizeFinish`/`findFinishes` de `src/rules/finish.ts`. */
export function resolveFinish(rawOrText: string): FinishResolution {
  return resolveWithEntries(rawOrText, listEntries());
}

/** Encuentra acabados en texto libre. Longest-first, límite de palabra. */
export function findFinishes(text: string): FinishHit[] {
  const live = listEntries().filter((e) => e.kind === 'alias' && e.finish);
  return collectMatches(text, live, 'scan').map((m) => ({
    finish: m.row.finish!,
    alias: m.row.alias,
    aliasSource: m.row.source,
    entryId: m.row.id,
    span: m.span,
  }));
}

/** Invariantes duros: una entrada que los rompe no puede existir en la base, ni con `force`. */
function assertStructural(e: NewFinishAlias): void {
  if (e.kind === 'alias') {
    if (!e.finish?.trim()) throw new Error('Un alias debe llevar un acabado canónico, no null ni vacío.');
  } else if (e.finish !== null) {
    throw new Error('not_a_finish debe llevar finish=null.');
  }
}

function canonicalFinish(e: NewFinishAlias): NewFinishAlias {
  if (e.kind === 'not_a_finish') return { ...e, finish: null };
  return { ...e, finish: e.finish ? fold(e.finish.trim()) : null };
}

/**
 * Las guardas de política, como lista de avisos en vez de excepción.
 *
 * Alias corto, ambigüedad, regresión de la tabla y regresión del gold. En la ruta normal la primera
 * corta el alta —con el mismo mensaje de siempre— y en la de `force` no corta ninguna: se devuelven
 * como avisos y el alta se escribe igual. La política de bloqueo vive en quien llama, no aquí.
 */
function guardWarnings(e: NewFinishAlias, live: FinishAliasRow[], at: string, opts: AddFinishOptions): string[] {
  const w: string[] = [];
  if (e.alias.trim().length < 3 && !opts.allowShortAlias) {
    w.push(
      `El alias '${e.alias}' tiene menos de 3 caracteres. Los alias cortos (ZN, ZP, BL) son del cliente ` +
      'y van con límite de palabra justamente para no convertir un BL cualquiera en PAVONADO. ' +
      'Confirma con allowShortAlias si es deliberado.',
    );
  }
  try { assertNoAmbiguity(e, live); } catch (err) { w.push(err instanceof Error ? err.message : String(err)); }
  try { assertNoRegression(e, live); } catch (err) { w.push(err instanceof Error ? err.message : String(err)); }
  if (!opts.skipGoldCheck) {
    try {
      assertGoldUnchanged([...live, { ...e, decidedAt: at, retiredAt: null, retiredWhy: null }]);
    } catch (err) {
      w.push(err instanceof Error ? err.message : String(err));
    }
  }
  return w;
}

function assertNoAmbiguity(e: NewFinishAlias, live: FinishAliasRow[]): void {
  const needle = fold(e.alias);
  const incomingKey = e.kind === 'not_a_finish' ? 'not_a_finish' : `alias:${e.finish}`;
  const clash = live.find((x) => fold(x.alias) === needle && resolutionKey(x) !== incomingKey);
  if (clash) {
    const target = clash.kind === 'alias' ? clash.finish : 'no-acabado';
    const incoming = e.kind === 'alias' ? e.finish : 'no-acabado';
    throw new Error(
      `'${e.alias}' ya lleva a ${target} por la entrada '${clash.id}'. ` +
      `Añadir ${incoming} la haría ambigua y mandaría a revisión todas sus líneas. ` +
      `Retira '${clash.id}' con su motivo si la decisión ha cambiado.`,
    );
  }
}

function assertNoRegression(e: NewFinishAlias, live: FinishAliasRow[]): void {
  const simulated = [...live, { ...e, decidedAt: 'sim', retiredAt: null, retiredWhy: null }];
  const texts = [...live.map((r) => r.alias), ...goldFinishSamples()];

  for (const row of live) {
    const before = resolveWithEntries(row.alias, live);
    const after = resolveWithEntries(row.alias, simulated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(
        `La entrada '${e.alias}' cambiaría la lectura de '${row.alias}' (${row.id}). ` +
        'Un alias nuevo no puede colarse por debajo de otro y alterar lo que ya resuelve.',
      );
    }
  }

  for (const text of texts) {
    const before = findFinishesWithEntries(text, live);
    const after = findFinishesWithEntries(text, simulated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(
        `La entrada '${e.alias}' cambiaría la detección de acabado en '${text}'. ` +
        'Un alias más corto no puede ganarle a uno más largo que ya funciona.',
      );
    }
  }
}

/** Expuesto para tests de la guarda 3. */
export function assertNoRegressionForTest(e: NewFinishAlias, live: FinishAliasRow[]): void {
  assertNoAmbiguity(e, live);
  assertNoRegression(e, live);
}

function findFinishesWithEntries(text: string, entries: FinishAliasRow[]): FinishHit[] {
  const live = entries.filter((x) => x.kind === 'alias' && x.finish && !x.retiredAt);
  return collectMatches(text, live, 'scan').map((m) => ({
    finish: m.row.finish!,
    alias: m.row.alias,
    aliasSource: m.row.source,
    entryId: m.row.id,
    span: m.span,
  }));
}

function goldFinishSamples(): string[] {
  const values = new Set<string>();
  for (const line of loadGold()) {
    const cell = line.attributes.finish;
    if (cell.certainty !== 'C') continue;
    if (cell.value === null || cell.value === undefined || String(cell.value).trim() === '') continue;
    values.add(String(cell.value));
  }
  return [...values];
}

function assertGoldUnchanged(simulated: FinishAliasRow[]): void {
  const live = listEntries();
  for (const sample of goldFinishSamples()) {
    const before = resolveWithEntries(sample, live);
    const after = resolveWithEntries(sample, simulated);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(
        `La entrada cambiaría la lectura del acabado '${sample}' en el gold set. ` +
        'Una alta que rompe el gold set no se promueve.',
      );
    }
  }
}

export function addEntry(
  e: NewFinishAlias,
  at: string,
  logPath = process.env.VOCAB_FINISH_LOG ?? LOG_PATH,
  opts: AddFinishOptions = {},
): { warnings: string[] } {
  const entry = canonicalFinish(e);
  assertStructural(entry);
  const conn = openFinishDb();
  const exists = conn.prepare(`SELECT id FROM entry WHERE id = ?`).get(entry.id);
  if (exists) throw new Error(`Ya existe una entrada con id '${entry.id}'. Los ids son la traza de una compra: no se reutilizan.`);

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

export function retireEntry(
  id: string,
  why: string,
  by: string,
  at: string,
  logPath = process.env.VOCAB_FINISH_LOG ?? LOG_PATH,
): void {
  const conn = openFinishDb();
  const row = conn.prepare(`SELECT id, retired_at FROM entry WHERE id = ?`).get(id) as { id: string; retired_at: string | null } | undefined;
  if (!row) throw new Error(`No existe la entrada '${id}'.`);
  if (row.retired_at) throw new Error(`La entrada '${id}' ya se retiró el ${row.retired_at}.`);

  const ev: LogEvent = { action: 'retire', at, by, entryId: id, detail: why };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(ev)}\n`, 'utf8');
  applyLog(conn, logPath);
}

/** Para `rules:audit`: procedencia de cada alias. */
export function aliasProvenance(): { client: string[]; added: string[] } {
  const client: string[] = [];
  const added: string[] = [];
  for (const e of listEntries()) {
    const line = `${e.alias} -> ${e.kind === 'alias' ? e.finish : 'no-acabado'}`;
    (e.source === 'client' ? client : added).push(line);
  }
  return { client, added };
}

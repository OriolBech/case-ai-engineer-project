/**
 * Adaptador SQLite de `RevisionStore`. Fuera del dominio: no importa Next ni el LLM.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { IdentifiableLine } from '../domain/identity.ts';
import type { RevisionSnapshot, RevisionStore } from '../domain/ports.ts';

const DB_PATH = join('data', 'processing', 'revisions.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS revision_snapshots (
  project_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  at TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  PRIMARY KEY (project_id, revision_id)
);

CREATE TABLE IF NOT EXISTS rfq_exports (
  project_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  exported_at TEXT NOT NULL,
  PRIMARY KEY (project_id, revision_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_revision_snapshots_project ON revision_snapshots(project_id);
`;

let db: DatabaseSync | null = null;

export function openRevisionDb(opts: { dbPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.REVISIONS_DB ?? DB_PATH;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

/** Cierra y olvida. Costura para los tests. */
export function closeRevisionDb(): void {
  db?.close();
  db = null;
}

export class SqliteRevisionStore implements RevisionStore {
  private readonly conn: DatabaseSync;

  constructor(conn: DatabaseSync) {
    this.conn = conn;
  }

  save(snapshot: RevisionSnapshot): void {
    this.conn
      .prepare(
        `INSERT OR REPLACE INTO revision_snapshots (project_id, revision_id, at, lines_json)
         VALUES (?, ?, ?, ?)`,
      )
      .run(snapshot.projectId, snapshot.revisionId, snapshot.at, JSON.stringify(snapshot.lines));
  }

  load(projectId: string, revisionId: string): RevisionSnapshot | null {
    const r = this.conn
      .prepare(`SELECT project_id, revision_id, at, lines_json FROM revision_snapshots WHERE project_id = ? AND revision_id = ?`)
      .get(projectId, revisionId) as
      | { project_id: string; revision_id: string; at: string; lines_json: string }
      | undefined;
    if (!r) return null;
    return {
      projectId: r.project_id,
      revisionId: r.revision_id,
      at: r.at,
      lines: JSON.parse(r.lines_json) as IdentifiableLine[],
    };
  }

  listRevisions(projectId: string): string[] {
    const rows = this.conn
      .prepare(`SELECT revision_id FROM revision_snapshots WHERE project_id = ? ORDER BY at ASC`)
      .all(projectId) as { revision_id: string }[];
    return rows.map((r) => r.revision_id);
  }

  recordRfqExport(projectId: string, revisionId: string, fingerprints: string[]): void {
    const at = new Date().toISOString();
    const stmt = this.conn.prepare(
      `INSERT OR IGNORE INTO rfq_exports (project_id, revision_id, fingerprint, exported_at)
       VALUES (?, ?, ?, ?)`,
    );
    for (const fp of fingerprints) stmt.run(projectId, revisionId, fp, at);
  }

  getRfqExports(projectId: string, revisionId: string): ReadonlySet<string> {
    const rows = this.conn
      .prepare(`SELECT fingerprint FROM rfq_exports WHERE project_id = ? AND revision_id = ?`)
      .all(projectId, revisionId) as { fingerprint: string }[];
    return new Set(rows.map((r) => r.fingerprint));
  }
}

let store: SqliteRevisionStore | null = null;

export function getRevisionStore(opts: { dbPath?: string } = {}): SqliteRevisionStore {
  if (!store) store = new SqliteRevisionStore(openRevisionDb(opts));
  return store;
}

/** Reinicia singleton. Solo tests. */
export function resetRevisionStore(): void {
  closeRevisionDb();
  store = null;
}

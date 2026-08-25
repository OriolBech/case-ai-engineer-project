/**
 * Histórico de evaluación, en SQLite. Ver specs/SPEC-010-evaluation-history.md.
 *
 * Cuatro entidades: ejecución, métrica, resultado de línea y corrección humana. Append-only para
 * resultados y para eventos de corrección: el estado actual es una proyección materializada del
 * histórico `correction_events`, no un sustituto de ese histórico.
 *
 * Los JSON persistidos llevan versión de esquema (`toJson`/`fromJson`), y la base entera lleva la
 * suya en `schema_meta`. Abrir una base escrita con un esquema distinto revienta en vez de
 * reinterpretarla en silencio: es la misma decisión que ya toma `vocabulary-db.ts` para la siembra.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DB_PATH = join('data', 'eval', 'history.sqlite');
export const SCHEMA_VERSION = 2;

const META_SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  label TEXT,
  dataset_name TEXT NOT NULL,
  dataset_fingerprint TEXT NOT NULL,
  git_commit TEXT,
  git_dirty INTEGER NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  routing TEXT NOT NULL,
  critic_routing TEXT NOT NULL,
  policy_fingerprint TEXT NOT NULL,
  policy_overrides_json TEXT NOT NULL,
  configuration_fingerprint TEXT NOT NULL,
  rows INTEGER NOT NULL,
  gold_lines INTEGER NOT NULL,
  system_lines INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  cost_eur REAL,
  prices_configured INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON evaluation_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_dataset_fp ON evaluation_runs(dataset_fingerprint);

CREATE TABLE IF NOT EXISTS evaluation_metrics (
  run_id TEXT NOT NULL REFERENCES evaluation_runs(id),
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  numerator INTEGER,
  denominator INTEGER,
  PRIMARY KEY (run_id, scope, name)
);

CREATE TABLE IF NOT EXISTS evaluation_lines (
  run_id TEXT NOT NULL REFERENCES evaluation_runs(id),
  row_ref TEXT NOT NULL,
  gold_id TEXT,
  system_id TEXT,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, row_ref, gold_id, system_id)
);

CREATE INDEX IF NOT EXISTS idx_lines_run ON evaluation_lines(run_id);

CREATE TABLE IF NOT EXISTS human_corrections (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  run_id TEXT REFERENCES evaluation_runs(id),
  row_ref TEXT NOT NULL,
  line_id TEXT,
  attribute TEXT NOT NULL,
  previous_value TEXT,
  corrected_value TEXT,
  evidence TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROMOTED')),
  promoted_entry_id TEXT,
  approved_at TEXT,
  approved_by TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  promoted_at TEXT,
  promoted_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_corrections_status ON human_corrections(status);
CREATE INDEX IF NOT EXISTS idx_corrections_row ON human_corrections(row_ref, attribute);

CREATE TABLE IF NOT EXISTS correction_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  correction_id TEXT NOT NULL REFERENCES human_corrections(id),
  action TEXT NOT NULL CHECK (action IN ('PROPOSED', 'APPROVED', 'REJECTED', 'PROMOTED')),
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  promoted_entry_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_correction_events_id ON correction_events(correction_id, seq);

-- Sugerencias de vocabulario. Espeja el contrato del front (app/components/App.tsx 'SuggestionPatch'
-- = { attribute, match, value }) para que enchufar front <-> persistencia sea trivial, y añade el
-- ciclo de vida y el KPI que la UI en sesión no persiste. Ver src/eval/history/suggestions.ts.
CREATE TABLE IF NOT EXISTS vocab_suggestions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  run_id TEXT REFERENCES evaluation_runs(id),
  row_ref TEXT NOT NULL,
  line_id TEXT,
  -- Mismo alcance que el front: hoy sólo acabado y material tienen sugerencia en la UI.
  attribute TEXT NOT NULL CHECK (attribute IN ('finish', 'material')),
  -- 'SuggestionPatch.match': el raw que dispara la sugerencia (el propio del acabado, o la calidad
  -- para el material). Es texto LITERAL de la fila, así que hace también de evidencia: una sugerencia
  -- cuyo match no está en la fila es una invención con un formulario de consentimiento delante.
  match_text TEXT NOT NULL,
  -- 'SuggestionPatch.value': el valor de catálogo propuesto. No nulo una vez registrada.
  value TEXT NOT NULL,
  -- De dónde sale el valor. 'free_llm' NO existe a propósito: una sugerencia sale de una tabla
  -- cerrada o del texto de la fila, nunca de una llamada libre al modelo. El CHECK lo hace estructural.
  origin TEXT NOT NULL CHECK (origin IN ('closed_table', 'row_evidence')),
  -- El ciclo del front: SHOWN -> (aceptar) ACCEPTED -> (validar) VALIDATED, o SHOWN -> (descartar)
  -- REJECTED. ACCEPTED = aplicada y "Por validar" (fail-closed, no salta sola a resuelta).
  status TEXT NOT NULL CHECK (status IN ('SHOWN', 'ACCEPTED', 'VALIDATED', 'REJECTED')),
  decided_by TEXT,   -- quién aceptó o descartó
  decided_at TEXT,
  validated_by TEXT, -- quién validó la línea con la sugerencia ya aplicada
  validated_at TEXT,
  -- Error silencioso de lo aprobado: lo rellena una comprobación CIEGA posterior (gold/audit/QA), que
  -- NO es la validación del comprador —esa puede ser un sello sin mirar—. Es la cifra que más pesa.
  verified TEXT CHECK (verified IN ('correct', 'wrong')),
  verified_by TEXT,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON vocab_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_attr ON vocab_suggestions(attribute);
`;

let db: DatabaseSync | null = null;

function migrateV1ToV2(conn: DatabaseSync): void {
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn.exec(`
      ALTER TABLE human_corrections ADD COLUMN approved_at TEXT;
      ALTER TABLE human_corrections ADD COLUMN approved_by TEXT;
      ALTER TABLE human_corrections ADD COLUMN rejected_at TEXT;
      ALTER TABLE human_corrections ADD COLUMN rejected_by TEXT;
      ALTER TABLE human_corrections ADD COLUMN promoted_at TEXT;
      ALTER TABLE human_corrections ADD COLUMN promoted_by TEXT;

      CREATE TABLE correction_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        correction_id TEXT NOT NULL REFERENCES human_corrections(id),
        action TEXT NOT NULL CHECK (action IN ('PROPOSED', 'APPROVED', 'REJECTED', 'PROMOTED')),
        at TEXT NOT NULL,
        actor TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        promoted_entry_id TEXT
      );
      CREATE INDEX idx_correction_events_id ON correction_events(correction_id, seq);
    `);
    conn.exec(`
      INSERT INTO correction_events (correction_id, action, at, actor, detail)
      SELECT id, 'PROPOSED', created_at, author, 'Migrado desde esquema v1'
      FROM human_corrections;

      INSERT INTO correction_events (correction_id, action, at, actor, detail, promoted_entry_id)
      SELECT id, status, created_at, author,
             'Migrado desde esquema v1; fecha y actor de transición originales no disponibles',
             promoted_entry_id
      FROM human_corrections
      WHERE status != 'PENDING';
    `);
    conn.prepare(`UPDATE schema_meta SET value = ? WHERE key = 'version'`).run(
      String(SCHEMA_VERSION),
    );
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

export function openHistoryDb(opts: { dbPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.EVAL_HISTORY_DB ?? DB_PATH;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  // Igual que vocabulary-db.ts: dos procesos pueden abrir esto a la vez (una ejecución de `pnpm run
  // eval -- --save` y una consulta de `pnpm run eval:history`), y WAL deja leer mientras otro escribe.
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(META_SCHEMA);

  const meta = db.prepare(`SELECT value FROM schema_meta WHERE key = 'version'`).get() as
    | { value: string }
    | undefined;
  if (!meta) {
    db.exec(SCHEMA);
    db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('version', ?)`).run(String(SCHEMA_VERSION));
  } else if (Number(meta.value) === 1) {
    migrateV1ToV2(db);
    db.exec(SCHEMA);
  } else if (Number(meta.value) === SCHEMA_VERSION) {
    db.exec(SCHEMA);
  } else {
    throw new Error(
      `${dbPath} fue escrita con el esquema v${meta.value}, y este código espera v${SCHEMA_VERSION}. ` +
        'Falta una migración explícita: no se reinterpreta en silencio.',
    );
  }
  return db;
}

/** Cierra y olvida. Costura para los tests, igual que en vocabulary-db.ts. */
export function closeHistoryDb(): void {
  db?.close();
  db = null;
}

/** Envuelve un valor con la versión de su esquema JSON. Ver SPEC-010 §Modelo persistido. */
export function toJson(value: unknown): string {
  return JSON.stringify({ v: 1, data: value });
}

export function fromJson<T>(raw: string): T {
  const parsed = JSON.parse(raw) as { v: number; data: T };
  if (parsed.v !== 1) {
    throw new Error(`JSON persistido con versión de esquema ${parsed.v}, no soportada (esperado 1).`);
  }
  return parsed.data;
}

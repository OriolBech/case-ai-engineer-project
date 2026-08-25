/**
 * Historial de MTOs procesados desde la pantalla de subida.
 *
 * NO confundir con `src/eval/history/`: aquello guarda EJECUCIONES DE EVALUACIÓN contra el gold set
 * (SPEC-010), para medir KPI y comparar configuraciones. Esto es la otra mitad, sin spec propia:
 * cada vez que alguien sube un Excel real desde `/`, `app/api/process/route.ts` deja aquí el mismo
 * `ProcessSummary` que ya le enseñó, para poder reabrirlo sin volver a subir el fichero. Sin gold,
 * sin comparación, sin acierto — sólo lo que la app ya mostró en su momento.
 *
 * Vive en `app/lib/` y no en `src/` a propósito: depende del formato de cable de la app
 * (`ProcessSummary`), no de un concepto del dominio del pipeline. `processMto` no sabe que esto
 * existe, ni falta que le hace.
 *
 * Necesita el runtime de Node porque `node:sqlite` no corre en el runtime Edge.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toIdentifiables } from '../../src/domain/from-output.ts';
import { getRevisionStore } from '../../src/revisions/sqlite-store.ts';
import { projectIdFromFileName } from '../../src/revisions/project-id.ts';
import { recordLifecycleEvent } from '../../src/kpi/events.ts';
import type { ProcessSummary } from './api-types.ts';

const DB_PATH = join('data', 'processing', 'history.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS processed_mtos (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  file_name TEXT NOT NULL,
  rows_ingested INTEGER NOT NULL,
  rows_skipped INTEGER NOT NULL,
  lines_count INTEGER NOT NULL,
  resolved_count INTEGER NOT NULL,
  cost_eur REAL,
  prices_configured INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  llm_calls INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_mtos_created_at ON processed_mtos(created_at);
`;

let db: DatabaseSync | null = null;

export function openMtoHistoryDb(opts: { dbPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.MTO_HISTORY_DB ?? DB_PATH;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

/** Cierra y olvida. Costura para los tests. */
export function closeMtoHistoryDb(): void {
  db?.close();
  db = null;
}

export interface ProcessedMtoSummary {
  id: string;
  createdAt: string;
  fileName: string;
  rowsIngested: number;
  rowsSkipped: number;
  linesCount: number;
  resolvedCount: number;
  /** null cuando los precios no están configurados: nunca 0. */
  costEur: number | null;
  pricesConfigured: boolean;
  latencyMs: number;
  llmCalls: number;
}

/** Guarda un procesamiento completo. Un fallo al guardar no debe tumbar la respuesta al usuario. */
export function saveProcessedMto(summary: ProcessSummary): string {
  const conn = openMtoHistoryDb();
  const id = randomUUID();
  const at = new Date().toISOString();
  const projectId = projectIdFromFileName(summary.fileName);
  const resolvedCount = summary.lines.filter((l) => l.status === 'RESUELTA').length;
  conn
    .prepare(
      `INSERT INTO processed_mtos (
        id, created_at, file_name, rows_ingested, rows_skipped, lines_count, resolved_count,
        cost_eur, prices_configured, latency_ms, llm_calls, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      at,
      summary.fileName,
      summary.rowsIngested,
      summary.rowsSkipped,
      summary.lines.length,
      resolvedCount,
      summary.metrics.pricesConfigured ? summary.metrics.costEur : null,
      summary.metrics.pricesConfigured ? 1 : 0,
      summary.metrics.latencyMs,
      summary.metrics.llmCalls,
      JSON.stringify(summary),
    );
  try {
    getRevisionStore().save({
      projectId,
      revisionId: id,
      at,
      lines: toIdentifiables(summary.lines),
    });
  } catch (e) {
    console.error('No se pudo guardar snapshot de revisión:', e);
  }
  try {
    recordLifecycleEvent({
      projectId,
      revisionId: id,
      eventType: 'revision_opened',
      at,
      note: `MTO procesado: ${summary.fileName}`,
    });
  } catch (e) {
    console.error('No se pudo registrar apertura de revisión para KPI:', e);
  }
  return id;
}

function toSummaryRow(r: Record<string, unknown>): ProcessedMtoSummary {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    fileName: r.file_name as string,
    rowsIngested: r.rows_ingested as number,
    rowsSkipped: r.rows_skipped as number,
    linesCount: r.lines_count as number,
    resolvedCount: r.resolved_count as number,
    costEur: (r.cost_eur as number | null) ?? null,
    pricesConfigured: !!(r.prices_configured as number),
    latencyMs: r.latency_ms as number,
    llmCalls: r.llm_calls as number,
  };
}

export function listProcessedMtos(limit = 50): ProcessedMtoSummary[] {
  const conn = openMtoHistoryDb();
  return (
    conn
      .prepare(
        `SELECT id, created_at, file_name, rows_ingested, rows_skipped, lines_count, resolved_count,
                cost_eur, prices_configured, latency_ms, llm_calls
         FROM processed_mtos ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as Record<string, unknown>[]
  ).map(toSummaryRow);
}

export function getProcessedMto(id: string): ProcessSummary | null {
  const conn = openMtoHistoryDb();
  const r = conn.prepare(`SELECT payload_json FROM processed_mtos WHERE id = ?`).get(id) as { payload_json: string } | undefined;
  return r ? (JSON.parse(r.payload_json) as ProcessSummary) : null;
}

export function vocabularyEntryIdFromRule(rule: string | null): string | null {
  if (!rule) return null;
  return (
    rule.match(/^(?:P-3|P-12):(.+)$/)?.[1] ??
    rule.match(/^(?:name|quality):alias:(.+?)->/)?.[1] ??
    rule.match(/^standard:alias:(.+)$/)?.[1] ??
    null
  );
}

/**
 * Cuenta aplicaciones observadas de entradas promovidas en MTOs guardados.
 *
 * El pipeline deja el id de la entrada en `attribute.rule` (`P-3:<id>` / `P-12:<id>`). Se cuenta
 * cada atributo de cada línea que vuelve a usarla; no se infiere reutilización por el mero hecho de
 * que exista una promoción.
 */
export function countVocabularyRuleUses(entryIds: readonly string[]): number {
  const wanted = new Set(entryIds.filter(Boolean));
  if (wanted.size === 0) return 0;
  const rows = openMtoHistoryDb()
    .prepare(`SELECT payload_json FROM processed_mtos ORDER BY created_at`)
    .all() as Array<{ payload_json: string }>;
  let uses = 0;
  for (const row of rows) {
    const summary = JSON.parse(row.payload_json) as ProcessSummary;
    for (const line of summary.lines) {
      for (const attribute of Object.values(line.attributes)) {
        const entryId = vocabularyEntryIdFromRule(attribute.rule);
        if (entryId && wanted.has(entryId)) uses++;
      }
    }
  }
  return uses;
}

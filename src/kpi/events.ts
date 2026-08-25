import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  correctionTimingFromDurations,
  durationDistributionFromDurations,
  type CorrectionTimingKpi,
  type LifecycleEvent,
  type LifecycleEventType,
  type ProcurementLifecycleKpi,
} from './metrics.ts';

const DB_PATH = join('data', 'kpi', 'events.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS correction_kpi_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('started', 'saved'))
);

CREATE INDEX IF NOT EXISTS idx_correction_kpi_pair
  ON correction_kpi_events(session_id, line_id, occurred_at);

CREATE TABLE IF NOT EXISTS vocabulary_kpi_events (
  entry_id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  attribute TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS procurement_kpi_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'revision_opened', 'review_closed', 'rfq_sent', 'order_placed',
      'supplier_confirmed', 'delivered'
    )
  ),
  supplier TEXT,
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (project_id, revision_id, flow_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_procurement_kpi_flow
  ON procurement_kpi_events(project_id, revision_id, flow_id, occurred_at);
`;

export type CorrectionKpiEventType = 'started' | 'saved';

let db: DatabaseSync | null = null;

export function openKpiEventsDb(opts: { dbPath?: string } = {}): DatabaseSync {
  if (db) return db;
  const dbPath = opts.dbPath ?? process.env.KPI_EVENTS_DB ?? DB_PATH;
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

export function closeKpiEventsDb(): void {
  db?.close();
  db = null;
}

export function recordCorrectionKpiEvent(input: {
  sessionId: string;
  lineId: string;
  eventType: CorrectionKpiEventType;
  at?: string;
}): string {
  if (!input.sessionId.trim() || !input.lineId.trim()) throw new Error('Faltan sessionId o lineId.');
  const at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at))) throw new Error('La fecha del evento KPI no es válida.');
  const id = randomUUID();
  openKpiEventsDb()
    .prepare(
      `INSERT INTO correction_kpi_events (id, occurred_at, session_id, line_id, event_type)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, at, input.sessionId, input.lineId, input.eventType);
  return id;
}

export function correctionTimingKpi(): CorrectionTimingKpi {
  const rows = openKpiEventsDb()
    .prepare(
      `SELECT occurred_at, session_id, line_id, event_type
       FROM correction_kpi_events
       ORDER BY occurred_at, rowid`,
    )
    .all() as Array<{
      occurred_at: string;
      session_id: string;
      line_id: string;
      event_type: CorrectionKpiEventType;
    }>;

  const starts = new Map<string, number>();
  const durations: number[] = [];
  for (const row of rows) {
    const key = `${row.session_id}\0${row.line_id}`;
    const at = Date.parse(row.occurred_at);
    if (row.event_type === 'started') {
      starts.set(key, at);
      continue;
    }
    const startedAt = starts.get(key);
    if (startedAt === undefined || at < startedAt) continue;
    durations.push(at - startedAt);
    starts.delete(key);
  }
  return correctionTimingFromDurations(durations);
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Falta ${field}.`);
  return normalized;
}

export function recordVocabularyKpiEvent(input: {
  entryId: string;
  attribute: string;
  at?: string;
}): boolean {
  const entryId = requireText(input.entryId, 'entryId');
  const attribute = requireText(input.attribute, 'attribute');
  const at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at))) throw new Error('La fecha del alta de vocabulario no es válida.');
  const result = openKpiEventsDb()
    .prepare(
      `INSERT OR IGNORE INTO vocabulary_kpi_events (entry_id, occurred_at, attribute)
       VALUES (?, ?, ?)`,
    )
    .run(entryId, at, attribute);
  return result.changes > 0;
}

export function listVocabularyKpiEntryIds(): string[] {
  return (
    openKpiEventsDb()
      .prepare(`SELECT entry_id FROM vocabulary_kpi_events ORDER BY occurred_at, entry_id`)
      .all() as Array<{ entry_id: string }>
  ).map((row) => row.entry_id);
}

function toLifecycleEvent(row: Record<string, unknown>): LifecycleEvent {
  return {
    id: row.id as string,
    occurredAt: row.occurred_at as string,
    projectId: row.project_id as string,
    revisionId: row.revision_id as string,
    flowId: row.flow_id as string,
    eventType: row.event_type as LifecycleEventType,
    supplier: (row.supplier as string | null) ?? null,
    note: row.note as string,
  };
}

/**
 * Registra un hito de compra. Un mismo hito por flujo es idempotente: repetir una exportación RFQ
 * no crea una segunda muestra ni acorta artificialmente el plazo.
 */
export function recordLifecycleEvent(input: {
  projectId: string;
  revisionId: string;
  flowId?: string;
  eventType: LifecycleEventType;
  supplier?: string | null;
  note?: string;
  at?: string;
}): { id: string; created: boolean } {
  const projectId = requireText(input.projectId, 'projectId');
  const revisionId = requireText(input.revisionId, 'revisionId');
  const flowId = requireText(input.flowId ?? 'revision', 'flowId');
  const at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at))) throw new Error('La fecha del hito no es válida.');
  const conn = openKpiEventsDb();
  const id = randomUUID();
  const result = conn
    .prepare(
      `INSERT OR IGNORE INTO procurement_kpi_events (
        id, occurred_at, project_id, revision_id, flow_id, event_type, supplier, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      at,
      projectId,
      revisionId,
      flowId,
      input.eventType,
      input.supplier?.trim() || null,
      input.note?.trim() ?? '',
    );
  if (result.changes > 0) return { id, created: true };
  const existing = conn
    .prepare(
      `SELECT id FROM procurement_kpi_events
       WHERE project_id = ? AND revision_id = ? AND flow_id = ? AND event_type = ?`,
    )
    .get(projectId, revisionId, flowId, input.eventType) as { id: string } | undefined;
  if (!existing) throw new Error('No se pudo recuperar el hito idempotente.');
  return { id: existing.id, created: false };
}

export function listLifecycleEvents(limit = 50): LifecycleEvent[] {
  const rows = openKpiEventsDb()
    .prepare(
      `SELECT id, occurred_at, project_id, revision_id, flow_id, event_type, supplier, note
       FROM procurement_kpi_events
       ORDER BY occurred_at DESC, rowid DESC
       LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(toLifecycleEvent);
}

function durationsBetween(
  flows: Map<string, Map<LifecycleEventType, LifecycleEvent>>,
  start: LifecycleEventType,
  end: LifecycleEventType,
): number[] {
  const durations: number[] = [];
  for (const milestones of flows.values()) {
    const startEvent = milestones.get(start);
    const endEvent = milestones.get(end);
    if (!startEvent || !endEvent) continue;
    const duration = Date.parse(endEvent.occurredAt) - Date.parse(startEvent.occurredAt);
    if (duration >= 0) durations.push(duration);
  }
  return durations;
}

export function procurementLifecycleKpi(): ProcurementLifecycleKpi {
  const events = listLifecycleEvents(10_000);
  const eventCounts: Record<LifecycleEventType, number> = {
    revision_opened: 0,
    review_closed: 0,
    rfq_sent: 0,
    order_placed: 0,
    supplier_confirmed: 0,
    delivered: 0,
  };
  const flows = new Map<string, Map<LifecycleEventType, LifecycleEvent>>();
  for (const event of events) {
    eventCounts[event.eventType]++;
    const key = `${event.projectId}\0${event.revisionId}\0${event.flowId}`;
    const milestones = flows.get(key) ?? new Map<LifecycleEventType, LifecycleEvent>();
    milestones.set(event.eventType, event);
    flows.set(key, milestones);
  }
  return {
    eventCounts,
    reviewTime: durationDistributionFromDurations(durationsBetween(flows, 'revision_opened', 'review_closed')),
    rfqToOrder: durationDistributionFromDurations(durationsBetween(flows, 'rfq_sent', 'order_placed')),
    orderToSupplierConfirmation: durationDistributionFromDurations(
      durationsBetween(flows, 'order_placed', 'supplier_confirmed'),
    ),
    orderToDelivery: durationDistributionFromDurations(durationsBetween(flows, 'order_placed', 'delivered')),
    rfqToDelivery: durationDistributionFromDurations(durationsBetween(flows, 'rfq_sent', 'delivered')),
    recentEvents: events.slice(0, 20),
  };
}

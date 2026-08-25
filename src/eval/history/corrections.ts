/**
 * Correcciones humanas. Ver SPEC-010 §Aprendizaje supervisado y puntos 11-16.
 *
 * El bucle permitido es `ejecución -> revisión humana -> corrección pendiente -> aprobación ->
 * candidato de vocabulario/gold -> regresión -> promoción`. El que NO está permitido es que una
 * predicción del sistema se convierta en corrección por sí sola: por eso no existe ninguna función
 * que cree una `human_correction` a partir de una `evaluation_line` sin pasar por
 * `proposeCorrection`, que exige motivo y evidencia LITERAL de la fila. No hay login:
 * `author` es una etiqueta opcional, no una identidad.
 *
 * La promoción escribe sólo después de una confirmación explícita de regresión. Material/acabado
 * usan sus tablas y nombre/calidad/norma la capa 2 genérica. Medida, longitud y cantidad nunca
 * generan vocabulario.
 */
import { randomUUID } from 'node:crypto';
import { openHistoryDb } from './db.ts';
import { addEntry as addFinishEntry } from '../../rules/finish-db.ts';
import { addEntry as addMaterialEntry } from '../../rules/vocabulary-db.ts';
import { addGenericAlias } from '../../rules/generic-alias-db.ts';
import { fold } from '../../rules/text.ts';
import { normalizeClientName } from '../../rules/names.ts';
import { normalizeClientQuality } from '../../rules/quality.ts';
import { normalizeClientStandard } from '../../rules/standards.ts';

export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROMOTED';

export interface HumanCorrection {
  id: string;
  createdAt: string;
  runId: string | null;
  rowRef: string;
  lineId: string | null;
  attribute: string;
  previousValue: string | null;
  correctedValue: string | null;
  evidence: string;
  author: string;
  rationale: string;
  status: CorrectionStatus;
  promotedEntryId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  promotedAt: string | null;
  promotedBy: string | null;
}

export interface NewCorrection {
  runId: string | null;
  rowRef: string;
  lineId: string | null;
  attribute: string;
  previousValue: string | null;
  correctedValue: string | null;
  evidence: string;
  /** Etiqueta opcional. Vacío es válido: no hay autenticación en este case. */
  author?: string;
  rationale: string;
}

/**
 * Propone una corrección, en estado `PENDING`.
 *
 * `rowSourceText` no se persiste (duplicaría el Excel del cliente, fuera de alcance de SPEC-010):
 * sólo sirve para comprobar que `evidence` aparece literalmente en la fila. Sin esa comprobación,
 * "corrección" y "opinión" son la misma palabra.
 */
export function proposeCorrection(input: NewCorrection, rowSourceText: string, at: string): string {
  if (!input.evidence.trim()) {
    throw new Error('Falta evidencia literal. Una corrección sólo puede registrarse sobre la fila original.');
  }
  if (!input.rationale.trim()) throw new Error('Falta el motivo de la corrección.');

  const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!norm(rowSourceText).includes(norm(input.evidence))) {
    throw new Error(
      `La evidencia "${input.evidence}" no aparece literalmente en la fila ${input.rowRef}. No se registra: ` +
        'una corrección exige evidencia literal, no una paráfrasis.',
    );
  }

  const conn = openHistoryDb();
  const id = randomUUID();
  const author = input.author?.trim() ?? '';
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn
      .prepare(
        `INSERT INTO human_corrections (
          id, created_at, run_id, row_ref, line_id, attribute, previous_value, corrected_value,
          evidence, author, rationale, status, promoted_entry_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)`,
      )
      .run(
        id,
        at,
        input.runId,
        input.rowRef,
        input.lineId,
        input.attribute,
        input.previousValue,
        input.correctedValue,
        input.evidence,
        author,
        input.rationale,
      );
    conn
      .prepare(
        `INSERT INTO correction_events (correction_id, action, at, actor, detail)
         VALUES (?, 'PROPOSED', ?, ?, ?)`,
      )
      .run(id, at, author, input.rationale);
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
  return id;
}

function toCorrection(r: Record<string, unknown>): HumanCorrection {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    runId: (r.run_id as string | null) ?? null,
    rowRef: r.row_ref as string,
    lineId: (r.line_id as string | null) ?? null,
    attribute: r.attribute as string,
    previousValue: (r.previous_value as string | null) ?? null,
    correctedValue: (r.corrected_value as string | null) ?? null,
    evidence: r.evidence as string,
    author: r.author as string,
    rationale: r.rationale as string,
    status: r.status as CorrectionStatus,
    promotedEntryId: (r.promoted_entry_id as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
    approvedBy: (r.approved_by as string | null) ?? null,
    rejectedAt: (r.rejected_at as string | null) ?? null,
    rejectedBy: (r.rejected_by as string | null) ?? null,
    promotedAt: (r.promoted_at as string | null) ?? null,
    promotedBy: (r.promoted_by as string | null) ?? null,
  };
}

export interface CorrectionEvent {
  seq: number;
  correctionId: string;
  action: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'PROMOTED';
  at: string;
  actor: string;
  detail: string;
  promotedEntryId: string | null;
}

export function listCorrectionEvents(correctionId: string): CorrectionEvent[] {
  return (
    openHistoryDb()
      .prepare(`SELECT * FROM correction_events WHERE correction_id = ? ORDER BY seq`)
      .all(correctionId) as Record<string, unknown>[]
  ).map((r) => ({
    seq: r.seq as number,
    correctionId: r.correction_id as string,
    action: r.action as CorrectionEvent['action'],
    at: r.at as string,
    actor: r.actor as string,
    detail: r.detail as string,
    promotedEntryId: (r.promoted_entry_id as string | null) ?? null,
  }));
}

/** Dos valores distintos sobre la misma celda: regla de casa pendiente, no bug del modelo. SPEC-015. */
export interface ValueConflict {
  rowRef: string;
  attribute: string;
  evidence: string;
  values: Array<{ value: string | null; at: string; correctionId: string }>;
  status: 'UNRESOLVED';
}

const ACTIVE_CONFLICT_STATUSES: readonly CorrectionStatus[] = ['PENDING', 'APPROVED'];

function conflictKey(c: Pick<HumanCorrection, 'rowRef' | 'attribute' | 'evidence'>): string {
  return `${c.rowRef}\0${c.attribute}\0${c.evidence}`;
}

function normValue(v: string | null): string {
  return v?.trim() ?? '';
}

/**
 * Detecta correcciones PENDING/APPROVED con el mismo `(rowRef, attribute, evidence)` y valores
 * distintos. Ninguna se promociona sola; `classifyPromotion(_, true)` devuelve `policy_decision`.
 */
export function listValueConflicts(): ValueConflict[] {
  const active = listCorrections().filter((c) => (ACTIVE_CONFLICT_STATUSES as readonly string[]).includes(c.status));
  const groups = new Map<string, HumanCorrection[]>();
  for (const c of active) {
    const k = conflictKey(c);
    const g = groups.get(k) ?? [];
    g.push(c);
    groups.set(k, g);
  }
  const out: ValueConflict[] = [];
  for (const items of groups.values()) {
    const distinct = new Set(items.map((c) => normValue(c.correctedValue)));
    if (distinct.size <= 1) continue;
    out.push({
      rowRef: items[0]!.rowRef,
      attribute: items[0]!.attribute,
      evidence: items[0]!.evidence,
      values: items.map((c) => ({ value: c.correctedValue, at: c.createdAt, correctionId: c.id })),
      status: 'UNRESOLVED',
    });
  }
  return out;
}

/** True si la corrección participa en un conflicto de valor sin resolver. */
export function isInValueConflict(correctionId: string): boolean {
  return listValueConflicts().some((c) => c.values.some((v) => v.correctionId === correctionId));
}

export interface CorrectionKpi {
  pending: number;
  approved: number;
  promoted: number;
  rejected: number;
  conflicts: number;
  /** conflicts / (conflicts + aprobadas + rechazadas + promovidas). null si aún no hay decisiones. */
  conflictRate: number | null;
  promotedVerified: number;
  promotedWrong: number;
  silentErrorRate: number | null;
}

/** KPI propio de correcciones humanas, aparte del pipeline y de las sugerencias. SPEC-015. */
export function correctionKpi(): CorrectionKpi {
  const all = listCorrections();
  const pending = all.filter((c) => c.status === 'PENDING').length;
  const approved = all.filter((c) => c.status === 'APPROVED').length;
  const promoted = all.filter((c) => c.status === 'PROMOTED').length;
  const rejected = all.filter((c) => c.status === 'REJECTED').length;
  const conflicts = listValueConflicts().length;
  const decided = conflicts + approved + rejected + promoted;
  return {
    pending,
    approved,
    promoted,
    rejected,
    conflicts,
    conflictRate: decided ? conflicts / decided : null,
    promotedVerified: 0,
    promotedWrong: 0,
    silentErrorRate: null,
  };
}

export function listCorrections(opts: { status?: CorrectionStatus } = {}): HumanCorrection[] {
  const conn = openHistoryDb();
  const rows = opts.status
    ? (conn.prepare(`SELECT * FROM human_corrections WHERE status = ? ORDER BY created_at`).all(opts.status) as Record<string, unknown>[])
    : (conn.prepare(`SELECT * FROM human_corrections ORDER BY created_at`).all() as Record<string, unknown>[]);
  return rows.map(toCorrection);
}

export function getCorrection(id: string): HumanCorrection | null {
  const conn = openHistoryDb();
  const r = conn.prepare(`SELECT * FROM human_corrections WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? toCorrection(r) : null;
}

function requireStatus(c: HumanCorrection, expected: CorrectionStatus): void {
  if (c.status !== expected) throw new Error(`La corrección '${c.id}' está en estado ${c.status}, se esperaba ${expected}.`);
}

function requireCorrection(id: string): HumanCorrection {
  const c = getCorrection(id);
  if (!c) throw new Error(`No existe la corrección '${id}'.`);
  return c;
}

function requireActor(actor: string): string {
  const value = actor.trim();
  if (!value) throw new Error('Falta el actor de la decisión.');
  return value;
}

/** Aprobación humana explícita. Una corrección aprobada por error se rechaza; no se reescribe. */
export function approveCorrection(
  id: string,
  actor: string,
  at = new Date().toISOString(),
): void {
  const c = requireCorrection(id);
  requireStatus(c, 'PENDING');
  const decidedBy = requireActor(actor);
  const conn = openHistoryDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn
      .prepare(
        `UPDATE human_corrections
         SET status = 'APPROVED', approved_at = ?, approved_by = ?
         WHERE id = ?`,
      )
      .run(at, decidedBy, id);
    conn
      .prepare(
        `INSERT INTO correction_events (correction_id, action, at, actor)
         VALUES (?, 'APPROVED', ?, ?)`,
      )
      .run(id, at, decidedBy);
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

export function rejectCorrection(
  id: string,
  actor: string,
  at = new Date().toISOString(),
): void {
  const c = requireCorrection(id);
  if (c.status !== 'PENDING' && c.status !== 'APPROVED') {
    throw new Error(
      `La corrección '${c.id}' está en estado ${c.status}, se esperaba PENDING o APPROVED.`,
    );
  }
  const decidedBy = requireActor(actor);
  const conn = openHistoryDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn
      .prepare(
        `UPDATE human_corrections
         SET status = 'REJECTED', rejected_at = ?, rejected_by = ?
         WHERE id = ?`,
      )
      .run(at, decidedBy, id);
    conn
      .prepare(
        `INSERT INTO correction_events (correction_id, action, at, actor)
         VALUES (?, 'REJECTED', ?, ?)`,
      )
      .run(id, at, decidedBy);
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Promociona una corrección `APPROVED` en la tabla de vocabulario correspondiente.
 *
 * `regressionPassed` lo decide quien orqueste la promoción — hoy, un operador que ha corrido
 * `pnpm run check` y `pnpm run eval` a mano tras añadir la entrada candidata. Si la regresión no pasa,
 * la corrección se queda en `APPROVED`: una regresión NO revierte una aprobación humana (punto 15).
 */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function promoteCorrection(
  id: string,
  regressionPassed: boolean,
  promotedEntryId: string,
  actor: string,
  at = new Date().toISOString(),
): void {
  const c = requireCorrection(id);
  requireStatus(c, 'APPROVED');
  if (!regressionPassed) {
    throw new Error(`La corrección '${id}' no se promociona: la batería de regresión no ha pasado. Sigue APPROVED.`);
  }
  if (!promotedEntryId.trim()) throw new Error('Falta el id de la entrada de vocabulario promovida.');
  const decidedBy = requireActor(actor);
  const alias = c.evidence.trim();
  const rawTarget = (c.correctedValue ?? '').trim();
  if (!alias) throw new Error('Falta el alias literal a promover.');

  if (c.attribute === 'finish') {
    const isNotFinish = rawTarget.toLowerCase() === 'not_a_finish' || rawTarget.toLowerCase() === 'no-acabado';
    const target = isNotFinish ? null : fold(rawTarget);
    if (!isNotFinish && !target) throw new Error('Falta el acabado canónico a promover.');
    addFinishEntry({
      id: promotedEntryId,
      alias,
      kind: isNotFinish ? 'not_a_finish' : 'alias',
      finish: target,
      source: 'added',
      rationale: c.rationale,
      decidedBy,
      evidence: c.evidence,
    }, at.slice(0, 10), undefined, { allowShortAlias: alias.length < 3 });
  } else if (c.attribute === 'material') {
    if (rawTarget !== 'AC' && rawTarget !== 'INOX') {
      throw new Error(`El material corregido debe ser AC o INOX, no '${rawTarget}'.`);
    }
    addMaterialEntry(
      {
        id: promotedEntryId,
        matchKind: 'qualityPattern',
        matchValue: `^${escapeRe(fold(alias))}$`,
        material: rawTarget,
        rationale: c.rationale,
        decidedBy,
        source: c.evidence,
      },
      at.slice(0, 10),
    );
  } else if (c.attribute === 'name') {
    if (normalizeClientName(alias)) {
      throw new Error(`'${alias}' ya pertenece al catálogo de nombres del cliente (capa 1).`);
    }
    const target = normalizeClientName(rawTarget)?.value;
    if (!target) throw new Error(`'${rawTarget}' no pertenece al catálogo de nombres del cliente.`);
    addGenericAlias(
      {
        id: promotedEntryId,
        attribute: 'name',
        alias,
        value: target,
        rationale: c.rationale,
        decidedBy,
        evidence: c.evidence,
      },
      at,
    );
  } else if (c.attribute === 'quality') {
    if (normalizeClientQuality(alias).inCatalog) {
      throw new Error(`'${alias}' ya pertenece al catálogo de calidad del cliente (capa 1).`);
    }
    const target = normalizeClientQuality(rawTarget);
    if (!target.inCatalog) {
      throw new Error(`'${rawTarget}' no pertenece al catálogo de calidad del cliente.`);
    }
    addGenericAlias(
      {
        id: promotedEntryId,
        attribute: 'quality',
        alias,
        value: target.raw.trim(),
        rationale: c.rationale,
        decidedBy,
        evidence: c.evidence,
      },
      at,
    );
  } else if (c.attribute === 'standard') {
    if (normalizeClientStandard(alias)) {
      throw new Error(`'${alias}' ya pertenece al catálogo de normas del cliente (capa 1).`);
    }
    const target = normalizeClientStandard(rawTarget);
    if (!target) throw new Error(`'${rawTarget}' no tiene un formato de norma reconocido.`);
    addGenericAlias(
      {
        id: promotedEntryId,
        attribute: 'standard',
        alias,
        value: target.normalized,
        rationale: c.rationale,
        decidedBy,
        evidence: c.evidence,
      },
      at,
    );
  } else {
    throw new Error(`El atributo '${c.attribute}' no se promociona a vocabulario.`);
  }

  const conn = openHistoryDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    conn
      .prepare(
        `UPDATE human_corrections
         SET status = 'PROMOTED', promoted_entry_id = ?, promoted_at = ?, promoted_by = ?
         WHERE id = ?`,
      )
      .run(promotedEntryId, at, decidedBy, id);
    conn
      .prepare(
        `INSERT INTO correction_events (
          correction_id, action, at, actor, promoted_entry_id
        ) VALUES (?, 'PROMOTED', ?, ?, ?)`,
      )
      .run(id, at, decidedBy, promotedEntryId);
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
}

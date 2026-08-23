/**
 * Correcciones humanas. Ver SPEC-010 §Aprendizaje supervisado y puntos 11-16.
 *
 * El bucle permitido es `ejecución -> revisión humana -> corrección pendiente -> aprobación ->
 * candidato de vocabulario/gold -> regresión -> promoción`. El que NO está permitido es que una
 * predicción del sistema se convierta en corrección por sí sola: por eso no existe ninguna función
 * que cree una `human_correction` a partir de una `evaluation_line` sin pasar por
 * `proposeCorrection`, que exige autor, motivo y evidencia LITERAL de la fila.
 *
 * Esta primera implementación cubre el modelo y sus restricciones. La promoción real — escribir en
 * `vocabulary-db.ts` o proponer un cambio de gold, y ejecutar antes la batería de regresión — queda
 * como contrato (`promoteCorrection` valida las precondiciones) sin conectar el extremo a extremo:
 * eso exige una segunda pieza (quién dispara la regresión y con qué dataset) que amplía el alcance
 * de SPEC-010 y que la propia spec deja fuera de esta primera entrega.
 */
import { randomUUID } from 'node:crypto';
import { openHistoryDb } from './db.ts';
import { addEntry as addFinishEntry, FINISH_CATALOG, type Finish } from '../../rules/finish-db.ts';

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
}

export interface NewCorrection {
  runId: string | null;
  rowRef: string;
  lineId: string | null;
  attribute: string;
  previousValue: string | null;
  correctedValue: string | null;
  evidence: string;
  author: string;
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
  if (!input.author.trim()) throw new Error('Falta el autor de la corrección.');
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
      input.author,
      input.rationale,
    );
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

/** Aprobación humana explícita. Una corrección aprobada por error se rechaza; no se reescribe. */
export function approveCorrection(id: string): void {
  const c = requireCorrection(id);
  requireStatus(c, 'PENDING');
  openHistoryDb().prepare(`UPDATE human_corrections SET status = 'APPROVED' WHERE id = ?`).run(id);
}

export function rejectCorrection(id: string): void {
  const c = requireCorrection(id);
  requireStatus(c, 'PENDING');
  openHistoryDb().prepare(`UPDATE human_corrections SET status = 'REJECTED' WHERE id = ?`).run(id);
}

/**
 * Promociona una corrección `APPROVED`. `material` y `finish` escriben en sus tablas de vocabulario;
 * otros atributos promocionarían contra el gold, que esta primera entrega no conecta.
 *
 * `regressionPassed` lo decide quien orqueste la promoción — hoy, un operador que ha corrido
 * `pnpm run check` y `pnpm run eval` a mano tras añadir la entrada candidata. Si la regresión no pasa,
 * la corrección se queda en `APPROVED`: una regresión NO revierte una aprobación humana (punto 15).
 */
export function promoteCorrection(id: string, regressionPassed: boolean, promotedEntryId: string, at = new Date().toISOString().slice(0, 10)): void {
  const c = requireCorrection(id);
  requireStatus(c, 'APPROVED');
  if (c.attribute !== 'material' && c.attribute !== 'finish') {
    throw new Error(
      `Sólo 'material' y 'finish' tienen destino de promoción implementado. '${c.attribute}' promocionaría contra ` +
        'el gold, que esta implementación no conecta todavía.',
    );
  }
  if (!regressionPassed) {
    throw new Error(`La corrección '${id}' no se promociona: la batería de regresión no ha pasado. Sigue APPROVED.`);
  }
  if (!promotedEntryId.trim()) throw new Error('Falta el id de la entrada de vocabulario promovida.');

  if (c.attribute === 'finish') {
    const alias = (c.previousValue ?? c.evidence).trim();
    if (!alias) throw new Error('Falta el alias de acabado a promover.');
    const target = (c.correctedValue ?? '').trim();
    const isNotFinish = target.toLowerCase() === 'not_a_finish' || target.toLowerCase() === 'no-acabado';
    if (!isNotFinish && !FINISH_CATALOG.includes(target as Finish)) {
      throw new Error(
        `'${target}' no es uno de los siete acabados de §9. Un octavo acabado no se promueve por autoservicio.`,
      );
    }
    addFinishEntry({
      id: promotedEntryId,
      alias,
      kind: isNotFinish ? 'not_a_finish' : 'alias',
      finish: isNotFinish ? null : (target as Finish),
      source: 'added',
      rationale: c.rationale,
      decidedBy: c.author,
      evidence: c.evidence,
    }, at, undefined, { allowShortAlias: alias.length < 3 });
  }

  openHistoryDb().prepare(`UPDATE human_corrections SET status = 'PROMOTED', promoted_entry_id = ? WHERE id = ?`).run(promotedEntryId, id);
}

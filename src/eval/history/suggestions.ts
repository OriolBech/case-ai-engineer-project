/**
 * Sugerencias de vocabulario: persistencia + KPI PROPIO, alineado con el front.
 *
 * El front (`app/components/App.tsx`) trabaja las sugerencias en sesión y NO las persiste: acepta un
 * `SuggestionPatch { attribute: 'finish'|'material', match, value }`, lo re-aplica en caliente a las
 * líneas cuyo `raw` coincide con `match`, y las deja "Por validar" (fail-closed) hasta que una persona
 * valida. Este módulo es la otra mitad: guarda ese ciclo y calcula las dos cifras que la UI no puede,
 * con el MISMO vocabulario de campos (`attribute`, `match`, `value`) para que enchufarlo sea trivial.
 *
 * POR QUÉ UN KPI APARTE. Una sugerencia es el camino más barato del error seguro (una línea en
 * revisión) al error caro (una compra mal): un clic. Medida con el KPI del pipeline se lo comería, así
 * que van dos cifras separadas —las que evitan que en tres semanas esto sea un botón de autoresolver:
 *
 *   1. **Tasa de aceptación** = aceptadas / decididas. Cerca del 100% -> o debería ser una regla
 *      (resolver, no sugerir), o se aprueba sin mirar. Cerca del 0% -> el sugeridor es ruido. El
 *      número útil vive en medio; por eso es un KPI, no un objetivo a maximizar.
 *   2. **Error silencioso de lo aprobado** = mal / verificadas. De lo aprobado, cuánto resultó
 *      incorrecto. Es la cifra que de verdad pesa, y sólo se puede dar porque las líneas resueltas por
 *      sugerencia viven separadas de las que resuelve el sistema por sí mismo.
 *
 * LA DISTINCIÓN QUE HAY QUE NO PERDER: la VALIDACIÓN del comprador (el segundo paso del front) no es
 * la VERIFICACIÓN del KPI. El comprador puede validar sin mirar —es justo el riesgo—; el error
 * silencioso se mide contra una comprobación ciega posterior (gold/audit/QA), no contra el clic de
 * validar. Por eso son dos campos distintos.
 *
 * TRES GUARDAS ESTRUCTURALES (dos en el esquema, una aquí):
 *   - `attribute` sólo 'finish' | 'material' (el alcance del front hoy).
 *   - `origin` sólo 'closed_table' | 'row_evidence'. 'free_llm' no existe: una sugerencia jamás sale
 *     de una llamada libre al modelo.
 *   - `match` debe aparecer LITERALMENTE en la fila; `recordSuggestion` lo verifica. Es el mismo
 *     `raw` que el front usa para casar la sugerencia, así que ya es literal por construcción, y
 *     comprobarlo aquí cierra la puerta a registrar una sugerencia inventada por otra vía.
 *
 * Lo que se promete es la FORMA de la medida, no su valor: sin comprador delante el KPI sale 0/0,
 * exactamente como debe.
 */
import { randomUUID } from 'node:crypto';
import { openHistoryDb } from './db.ts';

/** Igual que `SuggestionPatch.attribute` del front. Hoy sólo estos dos tienen sugerencia en la UI. */
export type SuggestionAttribute = 'finish' | 'material';
export type SuggestionOrigin = 'closed_table' | 'row_evidence';
export type SuggestionStatus = 'SHOWN' | 'ACCEPTED' | 'VALIDATED' | 'REJECTED';
export type SuggestionVerdict = 'correct' | 'wrong';

export interface Suggestion {
  id: string;
  createdAt: string;
  runId: string | null;
  rowRef: string;
  lineId: string | null;
  attribute: SuggestionAttribute;
  /** `SuggestionPatch.match`: el raw que dispara la sugerencia, literal en la fila. */
  match: string;
  /** `SuggestionPatch.value`: el valor de catálogo propuesto. */
  value: string;
  origin: SuggestionOrigin;
  status: SuggestionStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  verified: SuggestionVerdict | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

/**
 * Lo que se registra al MOSTRAR una sugerencia. Los tres primeros campos son exactamente el
 * `SuggestionPatch` del front (`attribute`, `match`, `value`); el resto es el contexto que la UI ya
 * tiene a mano (qué línea, qué ejecución) y de dónde salió el valor.
 */
export interface NewSuggestion {
  runId: string | null;
  rowRef: string;
  lineId: string | null;
  attribute: SuggestionAttribute;
  match: string;
  value: string;
  origin: SuggestionOrigin;
}

const norm = (s: string): string => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Registra una sugerencia MOSTRADA. No resuelve nada por sí sola: entra en la cola de decisión.
 * `rowSourceText` no se persiste —duplicaría el Excel del cliente— y sólo sirve para comprobar que el
 * `match` aparece de verdad en la fila.
 */
export function recordSuggestion(input: NewSuggestion, rowSourceText: string, at: string): string {
  if (input.attribute !== 'finish' && input.attribute !== 'material') {
    throw new Error(`Atributo de sugerencia fuera de alcance: ${JSON.stringify(input.attribute)}. Sólo 'finish' o 'material'.`);
  }
  if (!input.value.trim()) throw new Error('Una sugerencia sin valor propuesto no es una sugerencia.');
  if (!input.match.trim()) {
    throw new Error('Falta el match (el raw de la fila). Sugerir sin anclaje en la fila es inventar con un formulario delante.');
  }
  if (input.origin !== 'closed_table' && input.origin !== 'row_evidence') {
    throw new Error(
      `Origen de sugerencia inválido: ${JSON.stringify(input.origin)}. Sólo 'closed_table' o ` +
        "'row_evidence'. Una sugerencia jamás sale de una llamada libre al modelo.",
    );
  }
  if (!norm(rowSourceText).includes(norm(input.match))) {
    throw new Error(
      `El match "${input.match}" no aparece literalmente en la fila ${input.rowRef}. No se sugiere: ` +
        'una sugerencia sólo puede señalar algo que el comprador ve en la propia fila.',
    );
  }

  const id = randomUUID();
  openHistoryDb()
    .prepare(
      `INSERT INTO vocab_suggestions (
        id, created_at, run_id, row_ref, line_id, attribute, match_text, value, origin,
        status, decided_by, decided_at, validated_by, validated_at, verified, verified_by, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SHOWN', NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
    )
    .run(
      id, at, input.runId, input.rowRef, input.lineId, input.attribute,
      input.match, input.value, input.origin,
    );
  return id;
}

function toSuggestion(r: Record<string, unknown>): Suggestion {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    runId: (r.run_id as string | null) ?? null,
    rowRef: r.row_ref as string,
    lineId: (r.line_id as string | null) ?? null,
    attribute: r.attribute as SuggestionAttribute,
    match: r.match_text as string,
    value: r.value as string,
    origin: r.origin as SuggestionOrigin,
    status: r.status as SuggestionStatus,
    decidedBy: (r.decided_by as string | null) ?? null,
    decidedAt: (r.decided_at as string | null) ?? null,
    validatedBy: (r.validated_by as string | null) ?? null,
    validatedAt: (r.validated_at as string | null) ?? null,
    verified: (r.verified as SuggestionVerdict | null) ?? null,
    verifiedBy: (r.verified_by as string | null) ?? null,
    verifiedAt: (r.verified_at as string | null) ?? null,
  };
}

export function listSuggestions(opts: { status?: SuggestionStatus } = {}): Suggestion[] {
  const conn = openHistoryDb();
  const rows = opts.status
    ? (conn.prepare(`SELECT * FROM vocab_suggestions WHERE status = ? ORDER BY created_at`).all(opts.status) as Record<string, unknown>[])
    : (conn.prepare(`SELECT * FROM vocab_suggestions ORDER BY created_at`).all() as Record<string, unknown>[]);
  return rows.map(toSuggestion);
}

function requireSuggestion(id: string): Suggestion {
  const r = openHistoryDb().prepare(`SELECT * FROM vocab_suggestions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!r) throw new Error(`No existe la sugerencia '${id}'.`);
  return toSuggestion(r);
}

/**
 * Aceptar una sugerencia (el `applySuggestion` del front): la aplica y la deja "Por validar". Es el
 * numerador de la tasa de aceptación. Sólo se acepta una sugerencia MOSTRADA.
 */
export function acceptSuggestion(id: string, by: string, at: string): void {
  const s = requireSuggestion(id);
  if (s.status !== 'SHOWN') throw new Error(`La sugerencia '${id}' está en ${s.status}, se esperaba SHOWN.`);
  openHistoryDb()
    .prepare(`UPDATE vocab_suggestions SET status = 'ACCEPTED', decided_by = ?, decided_at = ? WHERE id = ?`)
    .run(by, at, id);
}

/** Descartar una sugerencia mostrada. Cuenta como decidida-no-aceptada en la tasa de aceptación. */
export function rejectSuggestion(id: string, by: string, at: string): void {
  const s = requireSuggestion(id);
  if (s.status !== 'SHOWN') throw new Error(`La sugerencia '${id}' está en ${s.status}, se esperaba SHOWN.`);
  openHistoryDb()
    .prepare(`UPDATE vocab_suggestions SET status = 'REJECTED', decided_by = ?, decided_at = ? WHERE id = ?`)
    .run(by, at, id);
}

/**
 * Validar (el `validateLines` del front sobre una línea con sugerencia aplicada): segundo paso, de
 * ACCEPTED a VALIDATED. NO es la verificación del KPI —una validación puede ser un sello sin mirar—,
 * así que no toca el error silencioso; sólo registra que el comprador dio por buena la línea.
 */
export function validateSuggestion(id: string, by: string, at: string): void {
  const s = requireSuggestion(id);
  if (s.status !== 'ACCEPTED') throw new Error(`Sólo se valida una sugerencia ACEPTADA. '${id}' está en ${s.status}.`);
  openHistoryDb()
    .prepare(`UPDATE vocab_suggestions SET status = 'VALIDATED', validated_by = ?, validated_at = ? WHERE id = ?`)
    .run(by, at, id);
}

/**
 * Verifica, contra una comprobación CIEGA posterior, si una sugerencia aprobada era correcta. Es la
 * segunda cifra —el error silencioso de lo aprobado— y sólo aplica a lo aprobado (aceptado o
 * validado): una descartada no resolvió nada, así que no pudo resolver nada mal.
 */
export function verifySuggestion(id: string, verdict: SuggestionVerdict, by: string, at: string): void {
  const s = requireSuggestion(id);
  if (s.status !== 'ACCEPTED' && s.status !== 'VALIDATED') {
    throw new Error(`Sólo se verifica una sugerencia aprobada (ACCEPTED/VALIDATED). '${id}' está en ${s.status}.`);
  }
  openHistoryDb()
    .prepare(`UPDATE vocab_suggestions SET verified = ?, verified_by = ?, verified_at = ? WHERE id = ?`)
    .run(verdict, by, at, id);
}

export interface SuggestionKpi {
  shown: number;
  /** MOSTRADAS aún sin decidir. */
  pending: number;
  /** Aprobadas = aceptadas + validadas (validada es una aceptada que además se validó). */
  accepted: number;
  validated: number;
  rejected: number;
  /** accepted / (accepted + rejected). null cuando aún no hay ninguna decisión: 0/0 no es 0%. */
  acceptanceRate: number | null;
  /** Aprobadas que ya se han verificado contra una comprobación ciega. */
  acceptedVerified: number;
  acceptedWrong: number;
  /** acceptedWrong / acceptedVerified. null cuando no hay ninguna verificada todavía. */
  silentErrorRate: number | null;
}

export interface SuggestionKpiReport extends SuggestionKpi {
  perAttribute: Record<string, SuggestionKpi>;
}

const isApproved = (s: Suggestion): boolean => s.status === 'ACCEPTED' || s.status === 'VALIDATED';

function kpiOf(rows: Suggestion[]): SuggestionKpi {
  const shown = rows.length;
  const pending = rows.filter((s) => s.status === 'SHOWN').length;
  const accepted = rows.filter(isApproved).length;
  const validated = rows.filter((s) => s.status === 'VALIDATED').length;
  const rejected = rows.filter((s) => s.status === 'REJECTED').length;
  const decided = accepted + rejected;
  const approvedVerified = rows.filter((s) => isApproved(s) && s.verified !== null);
  const acceptedWrong = approvedVerified.filter((s) => s.verified === 'wrong').length;
  return {
    shown,
    pending,
    accepted,
    validated,
    rejected,
    acceptanceRate: decided ? accepted / decided : null,
    acceptedVerified: approvedVerified.length,
    acceptedWrong,
    silentErrorRate: approvedVerified.length ? acceptedWrong / approvedVerified.length : null,
  };
}

/** Las dos cifras, globales y por atributo. El desglose por atributo, porque los agregados esconden. */
export function suggestionKpi(): SuggestionKpiReport {
  const all = listSuggestions();
  const perAttribute: Record<string, SuggestionKpi> = {};
  for (const attr of [...new Set(all.map((s) => s.attribute))].sort()) {
    perAttribute[attr] = kpiOf(all.filter((s) => s.attribute === attr));
  }
  return { ...kpiOf(all), perAttribute };
}

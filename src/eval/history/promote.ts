/**
 * Orquestación fina de promoción de correcciones. SPEC-015.
 *
 * No corre eval: quien llama debe haber ejecutado la regresión y pasar `regressionPassed: true`
 * explícitamente. El pipeline (`processMto`) no lee correcciones; sólo vocabularios promovidos.
 */
import { classifyPromotion } from '../../domain/ports.ts';
import { getCorrection, isInValueConflict, promoteCorrection } from './corrections.ts';

export interface PromoteOptions {
  regressionPassed: boolean;
  promotedEntryId?: string;
  actor: string;
  at?: string;
}

/**
 * Promociona una corrección APPROVED si su destino lo permite y no hay conflicto de valor.
 * Los cinco atributos de vocabulario escriben capa 2; gramática/cantidad nunca lo hacen.
 */
export function orchestratePromotion(id: string, opts: PromoteOptions): void {
  const c = getCorrection(id);
  if (!c) throw new Error(`No existe la corrección '${id}'.`);
  if (c.status !== 'APPROVED') {
    throw new Error(`La corrección '${id}' está en ${c.status}, se esperaba APPROVED.`);
  }

  const conflict = isInValueConflict(id);
  const verdict = classifyPromotion(c.attribute, conflict);

  if (verdict.kind === 'policy_decision') {
    throw new Error(
      `La corrección '${id}' no se promociona: conflicto de valor sobre la misma celda. ` +
        'Resuelve la decisión de vocabulario antes.',
    );
  }
  if (verdict.kind === 'not_promotable') {
    throw new Error(
      `La corrección '${id}' no se promociona a vocabulario (${verdict.why ?? 'not_promotable'}).`,
    );
  }
  if (verdict.kind === 'gold_proposal') {
    throw new Error(
      `La corrección '${id}' promocionaría contra el gold, que esta implementación no conecta todavía.`,
    );
  }

  if (!opts.regressionPassed) {
    throw new Error(
      `La corrección '${id}' no se promociona: ejecuta primero la regresión (pnpm run eval -- --save).`,
    );
  }
  if (!opts.promotedEntryId?.trim()) {
    throw new Error('Falta el id de la entrada de vocabulario promovida.');
  }

  promoteCorrection(id, true, opts.promotedEntryId, opts.actor, opts.at);
}

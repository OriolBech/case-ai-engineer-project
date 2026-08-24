/**
 * Puertos del dominio. Los adaptadores (SQLite, UI, eval) viven fuera.
 * Nada aquí importa `app/` ni `src/lib/llm.ts`.
 */
import type { IdentifiableLine } from './identity.ts';

export interface RevisionSnapshot {
  projectId: string;
  revisionId: string;
  at: string;
  lines: IdentifiableLine[];
}

/** Persistencia de revisiones. El pipeline no lo lee. SPEC-014. */
export interface RevisionStore {
  save(snapshot: RevisionSnapshot): void;
  load(projectId: string, revisionId: string): RevisionSnapshot | null;
  listRevisions(projectId: string): string[];
  /** Huellas exportadas a RFQ en esa revisión. No infiere compra: solo registro explícito. */
  recordRfqExport(projectId: string, revisionId: string, fingerprints: string[]): void;
  getRfqExports(projectId: string, revisionId: string): ReadonlySet<string>;
}

export type PromotionKind = 'vocab_alias' | 'gold_proposal' | 'policy_decision' | 'not_promotable';

export interface PromotionVerdict {
  kind: PromotionKind;
  why?: string;
}

/**
 * Clasifica una corrección humana a un destino. No escribe. SPEC-015.
 * `measure` / `length` / `quantity` no van a alias.
 */
export interface PromotionClassifier {
  classify(attribute: string, conflict: boolean): PromotionVerdict;
}

export function classifyPromotion(attribute: string, conflict: boolean): PromotionVerdict {
  if (conflict) return { kind: 'policy_decision', why: 'value_conflict' };
  if (attribute === 'measure' || attribute === 'length') {
    return { kind: 'not_promotable', why: 'grammar' };
  }
  if (attribute === 'quantity') return { kind: 'gold_proposal', why: 'quantity_is_not_vocab' };
  if (
    attribute === 'finish' ||
    attribute === 'material' ||
    attribute === 'name' ||
    attribute === 'quality' ||
    attribute === 'standard'
  ) {
    return { kind: 'vocab_alias' };
  }
  return { kind: 'not_promotable', why: 'unknown_attribute' };
}

/**
 * Caso de uso: diff entre dos revisiones ya procesadas. 0 LLM. SPEC-014.
 */
import type { IdentifiableLine } from '../domain/identity.ts';
import { diffRevisions, summarizeDiff, type RevisionDelta } from '../domain/revision-diff.ts';

export type AnnotatedRevisionDelta = RevisionDelta & { rfqExported?: boolean };

export function annotateRfqExports(
  deltas: RevisionDelta[],
  exportedFingerprints: ReadonlySet<string>,
): AnnotatedRevisionDelta[] {
  return deltas.map((d) => {
    if (d.kind !== 'unchanged' && d.kind !== 'qty_changed') return d;
    if (d.previous.status !== 'RESUELTA') return d;
    if (!exportedFingerprints.has(d.previous.fingerprint)) return d;
    return { ...d, rfqExported: true };
  });
}

export function diffIdentifiableLines(
  previous: IdentifiableLine[],
  current: IdentifiableLine[],
  exportedFingerprints: ReadonlySet<string> = new Set(),
): {
  summary: ReturnType<typeof summarizeDiff>;
  deltas: AnnotatedRevisionDelta[];
} {
  const deltas = diffRevisions(previous, current);
  return {
    summary: summarizeDiff(deltas),
    deltas: annotateRfqExports(deltas, exportedFingerprints),
  };
}

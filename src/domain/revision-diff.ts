/**
 * Diff entre dos revisiones del mismo MTO. SPEC-014.
 *
 * Empareja por huella de contenido, no por posición. No resuelve, no compra, no llama al modelo.
 * Un falso “unchanged” sería el error caro del enunciado: recomprar o dejar de comprar mal.
 */
import type { IdentifiableLine } from './identity.ts';

export type RevisionDelta =
  | { kind: 'unchanged'; previous: IdentifiableLine; current: IdentifiableLine }
  | {
      kind: 'qty_changed';
      previous: IdentifiableLine;
      current: IdentifiableLine;
      from: number | null;
      to: number | null;
    }
  | { kind: 'added'; current: IdentifiableLine }
  | { kind: 'removed'; previous: IdentifiableLine }
  | { kind: 'ambiguous'; fingerprint: string; previous: IdentifiableLine[]; current: IdentifiableLine[] };

function groupByFingerprint(lines: IdentifiableLine[]): Map<string, IdentifiableLine[]> {
  const m = new Map<string, IdentifiableLine[]>();
  for (const line of lines) {
    const list = m.get(line.fingerprint) ?? [];
    list.push(line);
    m.set(line.fingerprint, list);
  }
  return m;
}

function sameQty(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a === b;
}

/**
 * Si ambos lados tienen exactamente una línea con esa huella, hay pareja.
 * Cualquier otra cardinalidad es ambigua: no se inventa un matching.
 */
export function diffRevisions(previous: IdentifiableLine[], current: IdentifiableLine[]): RevisionDelta[] {
  const prevG = groupByFingerprint(previous);
  const currG = groupByFingerprint(current);
  const keys = new Set([...prevG.keys(), ...currG.keys()]);
  const out: RevisionDelta[] = [];

  for (const fp of keys) {
    const p = prevG.get(fp) ?? [];
    const c = currG.get(fp) ?? [];

    if (p.length === 0) {
      for (const line of c) out.push({ kind: 'added', current: line });
      continue;
    }
    if (c.length === 0) {
      for (const line of p) out.push({ kind: 'removed', previous: line });
      continue;
    }
    if (p.length === 1 && c.length === 1) {
      const [prevLine, currLine] = [p[0], c[0]];
      if (sameQty(prevLine.quantity, currLine.quantity)) {
        out.push({ kind: 'unchanged', previous: prevLine, current: currLine });
      } else {
        out.push({
          kind: 'qty_changed',
          previous: prevLine,
          current: currLine,
          from: prevLine.quantity,
          to: currLine.quantity,
        });
      }
      continue;
    }
    out.push({ kind: 'ambiguous', fingerprint: fp, previous: p, current: c });
  }

  return out;
}

export function summarizeDiff(deltas: RevisionDelta[]): {
  added: number;
  removed: number;
  qtyChanged: number;
  unchanged: number;
  ambiguous: number;
} {
  const s = { added: 0, removed: 0, qtyChanged: 0, unchanged: 0, ambiguous: 0 };
  for (const d of deltas) {
    if (d.kind === 'added') s.added += 1;
    else if (d.kind === 'removed') s.removed += 1;
    else if (d.kind === 'qty_changed') s.qtyChanged += 1;
    else if (d.kind === 'unchanged') s.unchanged += 1;
    else s.ambiguous += 1;
  }
  return s;
}

import type { OutputLine } from '../../src/pipeline/types.ts';

export function StatusBadge({ line, confirmed }: { line: OutputLine; confirmed: boolean }) {
  if (confirmed) return <span className="badge confirmed"><span className="dot" />Confirmada</span>;
  if (line.status === 'RESUELTA') return <span className="badge resuelta"><span className="dot" />Resuelta</span>;
  // P-9: "revisión" sería mentira. No hay nada que revisar; hay que darle la fila a otra familia.
  if (line.reasons.some((r) => r.kind === 'OUT_OF_SCOPE')) {
    return <span className="badge outfamily"><span className="dot" />Otra familia</span>;
  }
  return <span className="badge review"><span className="dot" />Revisión</span>;
}

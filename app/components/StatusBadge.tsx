import type { OutputLine } from '../../src/pipeline/types.ts';

export function StatusBadge({ line, confirmed }: { line: OutputLine; confirmed: boolean }) {
  if (confirmed) return <span className="badge confirmed"><span className="dot" />Confirmada</span>;
  if (line.status === 'RESUELTA') return <span className="badge resuelta"><span className="dot" />Resuelta</span>;
  return <span className="badge review"><span className="dot" />Revisión</span>;
}

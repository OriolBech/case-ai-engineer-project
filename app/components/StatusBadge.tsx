import type { OutputLine } from '../../src/pipeline/types.ts';

/**
 * `confirmed` = decisión tomada en esta sesión (sugerencia guardada o validación a mano).
 * Cuenta como resuelta.
 *
 * `reopened` = una persona la ha devuelto a revisión desde "resueltas". Va primero porque manda
 * sobre todo lo demás, incluido un `RESUELTA` del pipeline: el estado que se enseña es el que decide
 * si esa línea se pide o no, y ahí la última palabra la tiene quien compra. Etiqueta propia y no
 * "Revisión" a secas, porque el siguiente paso es distinto —no le falta un dato, alguien la ha
 * parado— y quien la vea mañana tiene derecho a saber que la paró una persona.
 */
export function StatusBadge({
  line,
  confirmed,
  reopened = false,
}: {
  line: OutputLine;
  confirmed: boolean;
  reopened?: boolean;
}) {
  if (reopened) return <span className="badge reopened"><span className="dot" />Devuelta</span>;
  if (confirmed) return <span className="badge confirmed"><span className="dot" />Validada</span>;
  if (line.status === 'RESUELTA') return <span className="badge resuelta"><span className="dot" />Resuelta</span>;
  // P-9: "revisión" sería mentira. No hay nada que revisar; hay que darle la fila a otra familia.
  if (line.reasons.some((r) => r.kind === 'OUT_OF_SCOPE')) {
    return <span className="badge outfamily"><span className="dot" />Otra familia</span>;
  }
  return <span className="badge review"><span className="dot" />Revisión</span>;
}

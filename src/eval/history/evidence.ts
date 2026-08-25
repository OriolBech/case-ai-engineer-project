/**
 * Qué cuenta como evidencia literal de una corrección. SPEC-015.
 *
 * Vive aparte, y sin `node:sqlite`, por una razón concreta: la regla la aplican DOS sitios. El
 * servidor la impone —`proposeCorrection` rechaza lo que no aparece en la fila— y el panel del
 * comprador la comprueba mientras escribe, para que no descubra el rechazo después de redactar el
 * motivo. Escrita dos veces, las dos copias divergen en cuanto una cambie el plegado de espacios, y
 * el resultado sería un formulario que da por buena una evidencia que el servidor rechaza.
 *
 * El plegado es deliberadamente laxo con lo que no cambia el significado (espacios, mayúsculas,
 * formas Unicode) y estricto con todo lo demás: la evidencia es un trozo del papel, no un resumen.
 */

const fold = (s: string): string => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();

/** ¿Aparece la evidencia tal cual en el texto de la fila? */
export function evidenceMatches(rowSourceText: string, evidence: string): boolean {
  return fold(rowSourceText).includes(fold(evidence));
}

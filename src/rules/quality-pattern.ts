/**
 * El patrón con el que una entrada de material se ata a UNA calidad concreta.
 *
 * `deriveMaterial` prueba los patrones con `new RegExp(matchValue, 'i')` contra el texto plegado, así
 * que un patrón sin anclar cubre de más: `GR 12H` casaría también dentro de `GR 12HX`, y una entrada
 * de vocabulario que cubre de más es material equivocado comprado con la confianza de una tabla.
 *
 * Vive aquí, y no en cada llamante, porque hay dos que tienen que producir exactamente el mismo
 * patrón: el candidato que `coverage.ts` redacta para el backlog y el alta que el comprador guarda
 * desde la línea. Si divergen, la misma decisión escrita desde dos sitios genera dos entradas que no
 * son la misma, y eso es una ambigüedad fabricada por nosotros.
 */

/** Un patrón que casa esa calidad y sólo esa, literal y anclado. */
export function exactQualityPattern(rawQuality: string): string {
  return `^${rawQuality.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
}

/**
 * De la línea a la decisión que la desbloquea.
 *
 * El backlog (`src/pipeline/coverage.ts`) agrupa por VALOR: una decisión aunque el valor salga en
 * cuarenta filas. Eso está bien para CONTAR —una decisión que desbloquea cuarenta filas vale más que
 * cuarenta que desbloquean una— y está mal para ACTUAR: quien revisa el MTO no lee un backlog, lee
 * su cola. Este módulo recorre el camino inverso, de la línea a su decisión, para que la decisión se
 * tome donde se ve el problema: en el desplegable lateral de la fila.
 *
 * El emparejamiento es por el valor que provoca el hueco, no solo por la fila: una fila con dos
 * elementos puede tener el hueco en uno y no en el otro.
 */
import type { PolicyBacklogItem } from '../../src/pipeline/coverage.ts';
import type { OutputLine } from '../../src/pipeline/types.ts';
import { lineNeedsFinishVocab } from './finish-vocab-ui.ts';

function same(a: string | null | undefined, b: string): boolean {
  return typeof a === 'string' && a.trim().toUpperCase() === b.trim().toUpperCase();
}

/**
 * Las decisiones del backlog que ESTA línea puede cerrar.
 *
 * `UNPLACED_EVIDENCE` queda fuera a propósito: "la fila menciona una norma que ninguna línea lleva"
 * no se arregla con una entrada de vocabulario, se arregla releyendo la fila. Es información de la
 * fila, no una decisión de una línea, y ofrecer un formulario para ella sería mentir sobre lo que
 * ese formulario arregla.
 */
export function decisionsForLine(
  line: OutputLine,
  backlog: readonly PolicyBacklogItem[],
): PolicyBacklogItem[] {
  const out = backlog.filter((b) => {
    if (!b.rows.includes(line.rowRef)) return false;
    if (b.kind === 'UNCOVERED_DERIVATION' && b.attribute === 'material') {
      return line.attributes.material.normalized === null && same(line.attributes.quality.raw, b.value);
    }
    if (b.kind === 'UNKNOWN_VALUE' && b.attribute === 'quality') {
      return same(line.attributes.quality.raw, b.value);
    }
    if (b.kind === 'UNKNOWN_VALUE' && b.attribute === 'finish') {
      return line.attributes.finish.normalized === null && same(line.attributes.finish.raw, b.value);
    }
    return false;
  });
  // La calidad primero: de ella se deriva el material, así que decidirla en ese orden es el orden en
  // el que una de las dos puede dejar de hacer falta.
  const rank = (b: PolicyBacklogItem) =>
    b.attribute === 'quality' ? 0 : b.attribute === 'material' ? 1 : 2;
  return out.sort((a, b) => rank(a) - rank(b));
}

// ---------------------------------------------------------------------------
// Lo que la LÍNEA pide por sí sola, sin pasar por el backlog
// ---------------------------------------------------------------------------
//
// El acabado siempre se pudo dar de alta desde la propia línea (`lineNeedsFinishVocab`): se mira el
// atributo, no el backlog. Calidad y material no, y esa asimetría se notaba justo donde más duele —
// una calidad como `GR L7` o `GR B7` que §5 deja pasar tal cual NO genera hueco de calidad (es un
// grado ASTM conocido, y §5 manda conservarlo), así que la pantalla no ofrecía nada y parecía que el
// sistema se negaba a aprender. Aprender de una línea es el bucle entero del producto: los 90 s que
// cuesta corregirla una vez tienen que valer para todos los MTO siguientes.
//
// Así que las tres se disparan igual: desde el atributo de la línea. El backlog sigue existiendo para
// CONTAR y para traer el candidato ya redactado cuando lo hay, no para decidir si se puede decidir.

/**
 * Calidad fuera del catálogo §5 y sin entrada de vocabulario que le dé grupo.
 *
 * Se mira la regla y no la procedencia: `extracted_uncatalogued` también la lleva una calidad que la
 * capa 2 ya resolvió, y volver a pedir esa decisión sería pedirla dos veces. `quality:out_of_catalog`
 * es exactamente "ni §5 ni vocabulario". La ambigua queda fuera: dos entradas en conflicto no se
 * arreglan añadiendo una tercera, se arreglan retirando una.
 */
export function lineNeedsQualityVocab(line: OutputLine): boolean {
  const q = line.attributes.quality;
  return !!q.raw?.trim() && q.rule === 'quality:out_of_catalog';
}

/**
 * Material vacío teniendo la fila una calidad escrita, y sin una decisión que declare esa ausencia.
 *
 * `P-3:no-derivable` es una ausencia decidida con su motivo (una dureza no nombra el metal base): ahí
 * no hay nada que dar de alta, y ofrecerlo invitaría a contradecir una decisión ya tomada desde un
 * formulario de dos campos.
 */
export function lineNeedsMaterialVocab(line: OutputLine): boolean {
  const q = line.attributes.quality;
  const m = line.attributes.material;
  return !!q.raw?.trim() && m.normalized === null && m.rule !== 'P-3:no-derivable';
}

export type Attr = 'quality' | 'material' | 'finish';

/** Una decisión que esta línea puede cerrar, venga del backlog o de la propia línea. */
export interface LineDecision {
  attribute: Attr;
  /** El texto que la dispara, tal cual lo escribe el MTO. */
  value: string;
  title: string;
  detail: string;
  /** Las filas del MTO que desbloquea, si el backlog lo sabe. */
  rows: string[] | null;
  candidate?: Record<string, unknown>;
  /**
   * ¿Esta decisión está BLOQUEANDO la línea, o sólo se le puede enseñar algo al sistema?
   *
   * La distinción nació de una línea concreta: la 24.1 del MTO de sugerencias, con calidad `GR B16`.
   * Está fuera del catálogo de §5 —y §5 manda conservar tal cual lo que no lista—, su material sale
   * `AC` por la entrada `ac-astm-b16`, y tiene los siete atributos: está RESUELTA, y con razón.
   * Ofrecerle igualmente declarar su grupo es útil; llamar a eso "decisión pendiente" y avisarlo en la
   * cola es mentir sobre el estado de la línea, y contradice al propio panel de KPIs, que no la
   * cuenta porque no hay hueco.
   *
   * Bloquea si el proyecto debe una decisión ahí (hay hueco en el backlog) o si ese atributo es el
   * motivo por el que la línea está en revisión. Lo demás es afinado: no cambia esta línea.
   */
  blocking: boolean;
}

/**
 * Las decisiones de una línea. **El disparo es la línea; el backlog sólo enriquece.**
 *
 * Ésta es la corrección de fondo. Antes, calidad y material sólo se podían decidir si `coverage.ts`
 * había levantado un hueco, y hay casos en los que a propósito no lo levanta: un grado ASTM como
 * `GR L7` o `GR B7` está fuera del catálogo de §5 y §5 manda conservarlo tal cual, así que no es un
 * hueco… pero el comprador que sabe que en su casa equivale a un grupo concreto no tenía dónde
 * decirlo. El resultado era un sistema que parecía negarse a aprender justo en las líneas donde el
 * comprador sabe más que la tabla.
 *
 * El acabado nunca tuvo ese problema porque siempre se miró el atributo. Ahora los tres se miran
 * igual. Cuando además hay hueco, se usa su texto y sus filas: dice cuántas desbloquea, que es lo que
 * convierte 90 segundos de corrección en una regla que ya no vuelve a costar.
 */
export function decisionsOf(line: OutputLine, backlog: readonly PolicyBacklogItem[]): LineDecision[] {
  const items = decisionsForLine(line, backlog);
  const of = (a: Attr) => items.find((b) => b.attribute === a);
  // Un motivo de revisión colgado de ese atributo es la otra forma de bloquear: P-13 sobre el
  // material, P-12 sobre el acabado. El backlog dice "el proyecto debe una decisión"; el motivo dice
  // "esta línea no sale sin ella". Cualquiera de las dos basta.
  const blocks = (a: Attr) => !!of(a) || line.reasons.some((r) => r.attribute === a);
  const out: LineDecision[] = [];

  const q = line.attributes.quality.raw?.trim() ?? '';
  const f = line.attributes.finish.raw?.trim() ?? '';

  // El orden importa: de la calidad se deriva el material, así que decidir la calidad primero puede
  // hacer que la segunda decisión sobre.
  if (q && (lineNeedsQualityVocab(line) || of('quality'))) {
    const b = of('quality');
    const blocking = blocks('quality');
    out.push({
      attribute: 'quality',
      value: b?.value ?? q,
      // Dos títulos porque son dos cosas distintas. Cuando bloquea, la pregunta abierta es qué es ese
      // valor. Cuando no —§5 no lo lista y manda conservarlo, la línea sale entera— lo único que
      // falta es la equivalencia, y llamarlo "qué es" sugeriría que el valor está en duda.
      title: blocking
        ? `Qué es la calidad «${b?.value ?? q}»`
        : `Con qué es intercambiable «${q}»`,
      detail: b?.detail
        ?? `§5 no lista «${q}» y manda conservarla tal cual, así que esta línea está completa y correcta. `
          + 'Lo que el sistema no sabe es con qué es intercambiable: si en vuestra casa equivale a un grupo '
          + 'de §5, declararlo le servirá para agrupar y comparar en los MTO que vengan.',
      rows: b?.rows ?? null,
      candidate: b?.candidate,
      blocking,
    });
  }

  if (q && (lineNeedsMaterialVocab(line) || of('material'))) {
    const b = of('material');
    out.push({
      attribute: 'material',
      value: b?.value ?? q,
      title: `De qué material es la calidad «${b?.value ?? q}»`,
      detail: b?.detail
        ?? `Esta línea sale sin material porque ninguna entrada del vocabulario cubre la calidad «${q}». `
          + 'Decidir si es AC o INOX, o declararla no derivable con su motivo.',
      rows: b?.rows ?? null,
      candidate: b?.candidate,
      blocking: blocks('material'),
    });
  }

  if (f && (lineNeedsFinishVocab(line) || of('finish'))) {
    const b = of('finish');
    out.push({
      attribute: 'finish',
      value: b?.value ?? f,
      title: `Qué acabado es «${b?.value ?? f}»`,
      detail: b?.detail
        ?? `El catálogo de §9 no reconoce «${f}». La línea sale como si no llevara acabado, y §9 dice que `
          + 'un elemento con acabado y el mismo sin acabado son referencias distintas.',
      rows: b?.rows ?? null,
      candidate: b?.candidate,
      blocking: blocks('finish'),
    });
  }

  return out;
}

export function hasLineDecisions(line: OutputLine, backlog: readonly PolicyBacklogItem[]): boolean {
  return decisionsOf(line, backlog).some((d) => d.blocking);
}

/**
 * Los atributos que están BLOQUEANDO la línea. Lo usa la cola para el aviso por fila.
 *
 * Sólo los bloqueantes: la cola es la lista de lo que falta por hacer, y un "clic para decidir" sobre
 * una línea que ya está lista para pedir manda a mirar algo que no lo necesita. El afinado se
 * descubre al abrir la línea, que es cuando ya se está mirando esa fila de todos modos.
 */
export function blockingAttributes(line: OutputLine, backlog: readonly PolicyBacklogItem[]): Attr[] {
  return decisionsOf(line, backlog).filter((d) => d.blocking).map((d) => d.attribute);
}


/** El patrón ya redactado por el backlog, si lo hay. Si no, el panel lo deriva del texto. */
export function matchFromCandidate(candidate?: Record<string, unknown>): string | undefined {
  const when = candidate?.when as { qualityGroup?: string; qualityPattern?: string } | undefined;
  return when?.qualityGroup ?? when?.qualityPattern;
}

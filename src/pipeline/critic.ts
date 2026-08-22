/**
 * Stage 6 — the critic. See specs/SPEC-006-critic.md.
 *
 * WHAT IT IS FOR. The rules engine checks what it knows how to check: obligations, coherence,
 * catalogues. It cannot see the two failures that matter most, because both look perfectly valid
 * from inside the output:
 *
 *   - A material mentioned in the row that produced no line at all.
 *   - An attribute placed on the wrong element of a set.
 *
 * The second one is not hypothetical. `gpt-5.4-mini` returned `ASTM F436` — a standard — as the
 * QUALITY of the washer in rows 1 and 5, where the row states no quality at all. The line came out
 * RESUELTA instead of going to review. The span verifier cannot catch it either, because
 * `ASTM F436` really is in the text: the error is attribution, not invention. That is this
 * component's entire reason to exist.
 *
 * WHY IT IS SAFE ON A CHEAP MODEL. The critic may only DOWNGRADE. So a weak critic has two failure
 * modes and neither is dangerous: a false disagreement adds a line to the review queue (the cheap
 * error), and a false agreement simply leaves the line as the rules engine had it (no protection
 * gained, nothing lost). A component whose worst case is "no better than not having it" is exactly
 * where a cheap or open-weight model belongs.
 */

import type { Llm } from '../lib/llm.ts';
import type { Analysis } from './analyze.ts';
import type { MtoRow, OutputLine, Reason } from './types.ts';
import { ATTRIBUTE_KEYS } from './types.ts';

export type CriticRouting = 'multi_element' | 'all' | 'off';

export interface CriticVerdict {
  lineId: string;
  agrees: boolean;
  issue: 'MISSING_ELEMENT' | 'WRONG_ATTRIBUTION' | 'QUANTITY_CONTRADICTS' | 'OTHER' | null;
  attribute: string | null;
  explanation: string | null;
}

interface CriticResponse {
  verdicts: CriticVerdict[];
  /** A material named in the row that produced no line. Reported at row level, not per line. */
  missingElements: string[];
}

export const CRITIC_SYSTEM = `Eres el revisor de un sistema que extrae líneas de compra de tornillería a partir de filas de un
MTO. Te doy el texto original de una fila y las líneas que el sistema ha producido a partir de ella.
Tu trabajo es intentar REFUTARLAS.

No vuelves a extraer nada. Sólo compruebas tres cosas contra el texto original:

1. ¿Falta algún material? Si el texto menciona un tornillo, tuerca, arandela, espárrago o varilla
   roscada que no tiene su línea, dilo. No cuentes como faltante algo que el texto no menciona: un
   set no se completa por convención.

2. ¿Hay algún atributo puesto en el elemento equivocado? Es el fallo más importante. Ejemplos
   reales: la norma de la tuerca asignada al espárrago; una NORMA (ASTM F436, DIN 934) metida en el
   campo de calidad; la calidad del tornillo copiada a la tuerca cuando el texto sólo la da para el
   tornillo.

3. ¿Alguna cantidad contradice el texto? "W/2 HEX. NUT" sobre 40 espárragos son 80 tuercas.

Reglas de tu juicio:

- Un campo VACÍO no es un error. El MTO a menudo no trae el dato, y eso es correcto: la línea ya se
  irá a revisión por su cuenta. Sólo señalas lo que está PUESTO Y MAL, o lo que FALTA ENTERO.
- La medida se extrapola dentro de un set: si el tornillo dice M16 y la tuerca aparece con M16 sin
  que el texto lo repita, es correcto.
- La calidad NO se extrapola. Si la tuerca lleva una calidad que el texto sólo da para el tornillo,
  es un error de atribución.
- Ante la duda, DISCREPA. Mandar una línea a revisión no rompe nada; dar por buena una línea mal
  extraída cuesta semanas de obra.
- No propongas correcciones. Sólo dices si cuadra o no, y por qué.

## Lo que NO es tu trabajo

Cada valor se te da en la forma \`normalizado <- "literal de la fila" (procedencia)\`. La
TRANSFORMACIÓN de un valor no la juzgas tú: la aplican después las tablas del propio cliente, y
llevan su procedencia escrita. No es un error que el valor normalizado no se parezca al literal.

- \`tabla\`: la norma o el acabado traducidos por la tabla de equivalencias del cliente
  (DIN 931 -> ISO 4014, "zincado" -> CINCADO). Correcto por construcción.
- \`derivado\`: el material deducido de la calidad (A4-70 -> INOX, 8.8 -> AC). Es una política
  declarada del proyecto, no una invención del extractor.
- \`extrapolado\`: la medida heredada dentro del set. La única extrapolación permitida.
- \`inferido\`: multiplicidad o unidad de longitud asumidas. También política declarada.

Una procedencia NO es una bendición: \`literal fuera de catálogo\` significa que el valor se copió
del texto y NINGUNA tabla del cliente lo reconoce. Es el sitio donde hay que mirar más, no menos —
ahí es donde acaba un valor que se ha puesto en el campo equivocado, porque ninguna tabla lo iba a
contradecir. Vuelve al punto 2 con ese valor en la mano.

Lo que SÍ juzgas es de dónde sale el valor: en qué CAMPO se ha puesto y a qué ELEMENTO se le ha
atribuido. Una norma metida en el campo calidad sigue siendo un error aunque la norma esté en el
texto. Una calidad puesta en la tuerca cuando el texto sólo la da para el tornillo sigue siendo un
error aunque el valor exista. Eso es tu trabajo entero.`;

export const CRITIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts', 'missingElements'],
  properties: {
    missingElements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Materiales mencionados en el texto que no tienen línea',
    },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lineId', 'agrees', 'issue', 'attribute', 'explanation'],
        properties: {
          lineId: { type: 'string' },
          agrees: { type: 'boolean' },
          issue: {
            type: ['string', 'null'],
            enum: ['MISSING_ELEMENT', 'WRONG_ATTRIBUTION', 'QUANTITY_CONTRADICTS', 'OTHER', null],
          },
          attribute: { type: ['string', 'null'] },
          explanation: { type: ['string', 'null'] },
        },
      },
    },
  },
} as Record<string, unknown>;

/**
 * Provenance, in the words the prompt uses. The critic has to be able to tell a value the tables
 * transformed from a value the extractor moved to the wrong field, and those look identical if all
 * it sees is the normalized output.
 */
const PROVENANCE_ES: Record<string, string> = {
  exact_catalog: 'catálogo',
  table_normalized: 'tabla',
  extracted: 'literal',
  extracted_uncatalogued: 'literal fuera de catálogo',
  extrapolated: 'extrapolado',
  derived: 'derivado',
  inferred: 'inferido',
  absent: 'ausente',
  not_applicable: 'no aplica',
};

/**
 * Renders each value as `normalized <- "raw" (provenance)`.
 *
 * Showing only the normalized value was the critic's biggest source of noise: it was being asked to
 * compare the pipeline's OUTPUT against the row's RAW text with no way to know which differences
 * were legitimate, so it reported the client's own equivalence tables as errors — `DIN931` "changed"
 * to `ISO 4014`, `zincado` "changed" to `CINCADO`, a material `INOX` "invented" from the quality.
 * Three of its seven disagreements were exactly that, and each one cost a good line. The
 * transformation was never the critic's job; telling apart transformation from misattribution is,
 * and that needs the provenance.
 */
function renderLines(lines: OutputLine[]): string {
  return lines
    .map((l) => {
      const attrs = ATTRIBUTE_KEYS
        .map((k) => {
          const a = l.attributes[k];
          if (a.normalized === null) return `${k}=(vacío)`;
          const prov = PROVENANCE_ES[a.provenance] ?? a.provenance;
          const raw = a.raw !== null && a.raw !== a.normalized ? ` <- "${a.raw}"` : '';
          return `${k}=${a.normalized}${raw} (${prov})`;
        })
        .join(' · ');
      return `  ${l.id}: ${attrs} · cantidad=${l.quantity ?? '(sin cantidad)'}`;
    })
    .join('\n');
}

/**
 * Which rows are worth a critic call.
 *
 * By decomposition risk, NOT by a confidence score. An earlier design gated on the confidence
 * scalar and would have called the critic on 72% of lines — because the derived material (P-3)
 * depresses almost every line's minimum, making the score nearly constant and useless for routing.
 * Attribution risk only exists where there is more than one element to attribute to.
 */
export function needsCritic(analysis: Analysis, routing: CriticRouting): boolean {
  if (routing === 'off') return false;
  if (analysis.error || analysis.skippedLlm || analysis.outOfFamily) return false;
  if (routing === 'all') return analysis.elements.length > 0;
  return analysis.elements.length > 1 || analysis.hallucinations.length > 0;
}

export interface CriticResult {
  lines: OutputLine[];
  ran: boolean;
  downgraded: string[];
  missingElements: string[];
}

export async function criticiseRow(
  llm: Llm,
  row: MtoRow,
  analysis: Analysis,
  lines: OutputLine[],
  routing: CriticRouting = 'multi_element',
): Promise<CriticResult> {
  if (!needsCritic(analysis, routing) || lines.length === 0) {
    return { lines, ran: false, downgraded: [], missingElements: [] };
  }

  let res: CriticResponse;
  try {
    const out = await llm.complete<CriticResponse>({
      system: CRITIC_SYSTEM,
      user: `TEXTO ORIGINAL DE LA FILA ${row.itemRef}:\n${row.sourceText}\n\nLÍNEAS PRODUCIDAS:\n${renderLines(lines)}`,
      schema: CRITIC_SCHEMA,
      schemaName: 'critic_verdicts',
      tier: 'critic',
      maxTokens: 2048,
    });
    res = out.data;
  } catch {
    // The critic is a safety net, not a dependency. If it fails, the rules engine's verdict stands:
    // failing the whole row because the optional check broke would be the worse outcome.
    return { lines, ran: false, downgraded: [], missingElements: [] };
  }

  // Defensive on purpose: strict schemas are enforced by the provider, and not every provider —
  // especially not every open-weight model behind OpenRouter — honours them perfectly. A missing
  // `verdicts` field used to take the whole run down with a `.map of undefined`. The critic is
  // optional; a malformed critic response must degrade to "no opinion", never to a crash.
  const verdicts = Array.isArray(res?.verdicts) ? res.verdicts : [];
  const byId = new Map(verdicts.filter((v) => v && typeof v.lineId === 'string').map((v) => [v.lineId, v]));
  const downgraded: string[] = [];

  const out = lines.map((line) => {
    const v = byId.get(line.id);
    if (!v || v.agrees) return line;
    // ONLY downgrade. A critic that could promote would be a second extractor with less
    // information, and it would raise the silent error rate instead of lowering it.
    if (line.status === 'REVISION_MANUAL') return line;
    downgraded.push(line.id);
    const reason: Reason = {
      code: 'CRITIC_DISAGREES',
      kind: 'LOW_CONFIDENCE',
      message: v.explanation
        ? `La revisión automática no cuadra con el texto original: ${v.explanation}`
        : 'La revisión automática no cuadra con el texto original',
      attribute: (ATTRIBUTE_KEYS as readonly string[]).includes(v.attribute ?? '')
        ? (v.attribute as (typeof ATTRIBUTE_KEYS)[number])
        : null,
    };
    return { ...line, status: 'REVISION_MANUAL' as const, reasons: [...line.reasons, reason] };
  });

  const missing = Array.isArray(res?.missingElements) ? res.missingElements.filter((x) => typeof x === 'string') : [];
  return { lines: out, ran: true, downgraded, missingElements: missing };
}

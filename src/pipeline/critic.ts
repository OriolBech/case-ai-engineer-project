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

/**
 * The project's default routing, and **the default is `off` because that is what got measured**.
 *
 * The critic was built for one error the rules engine could not see: `gpt-5.4-mini` putting the
 * standard `ASTM F436` into the QUALITY field of the washer on rows 1 and 5, which came out
 * RESUELTA. That error no longer survives the rules engine — `ASTM F436` in quality is
 * `extracted_uncatalogued`, and the validator raises `UNMAPPED_VALUE` on it by itself, offline and
 * for free. Replaying the frozen `gpt-5.4-mini` fixture (`scripts/critic-eval.ts`), which is the
 * only output with known errors we have, gives **0 silent errors with the critic off**: its recall
 * target set is empty. The validator absorbed the job.
 *
 * What did not vanish is the cost. Six live passes — three over the gold set, three over the
 * fixture — produced four downgrades and **all four were false positives**, of three kinds, none of
 * which the prompt is able to prevent even though it forbids all three by name:
 *
 *   - `standard`: relitigates the §8 equivalence table, and gets it backwards (claims DIN 933 maps
 *     to ISO 4014; §8 says ISO 4017).
 *   - `material`: relitigates P-3 derivation (claims `GR 2H` is INOX; A194 Gr 2H is carbon steel).
 *   - `finish`: relitigates P-1 scope inside a set.
 *
 * `docs/05-results.md` set the criterion in advance — *"if it doesn't lower silent error, it's
 * removed"* — and applied to today's numbers the criterion answers itself.
 *
 * It is a flag and not a deletion because the premise can come back: a weaker extractor, a new
 * model, a corpus the rules do not cover. The test for that is `pnpm run critic:eval`. The day it
 * reports `errores reales > 0`, the critic has a job again and this default should be revisited.
 */
export function criticRoutingFromEnv(env: NodeJS.ProcessEnv = process.env): CriticRouting {
  const v = (env.CRITIC_ROUTING ?? 'off').trim();
  return v === 'multi_element' || v === 'all' || v === 'off' ? v : 'off';
}

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

/**
 * Output token budget for one critic call.
 *
 * NOT a round number pulled from nowhere. It was 2048, and 2048 is what the critic's own reasoning
 * costs before it writes a single verdict: the critic tier runs `gpt-oss-120b` with
 * `LLM_REASONING_EFFORT_CRITIC=high` — the dial that took its precision from 33% to 100%
 * (docs/05-results.md) — and on OpenRouter thinking tokens are charged against `max_tokens`.
 * So the harder the row, the more likely the safety net was to run out of budget and vanish. It
 * failed on row 63 of the synthetic set: three elements, three different quality groups, two
 * attributes misread — the single row in 79 where the critic was most needed.
 */
const CRITIC_MAX_TOKENS = 8192;

export interface CriticResult {
  lines: OutputLine[];
  ran: boolean;
  downgraded: string[];
  missingElements: string[];
  /**
   * Why the critic did not run, when it was supposed to. Null when it ran, or when the row was
   * never eligible.
   *
   * It exists because `ran: false` used to mean two things that are not remotely the same —
   * "this row did not need checking" and "the check broke and nobody was told" — and the caller
   * could not tell them apart. A safety net that silently stops being there is worse than no
   * safety net, because the number on the panel does not move.
   */
  failure: string | null;
}

/**
 * Provenances that mean **the extractor chose this value and put it on this element**.
 *
 * Everything outside this set was produced by the rules engine after the extractor was done:
 * `derived` is P-3 reading the material off the quality, `inferred` is P-2 assuming a multiplicity,
 * `extrapolated` is §2 carrying the measure across a set, `absent` and `not_applicable` are the
 * absence of a value. None of them is a placement, so none of them can be a *misplacement* — which
 * is the only thing this component exists to find.
 *
 * `table_normalized` is deliberately OUT, and it is the one that costs something. A value the
 * client's table translated was placed by the extractor, so in principle its placement could be
 * wrong — a quality copied onto the nut is still a quality copied onto the nut after `8.8 -> G5`.
 * But it is also the provenance the critic most often uses to relitigate the translation itself:
 * measured, it claimed `DIN 933` maps to `ISO 4014` when §8 says `ISO 4017`, and it filed that
 * under `WRONG_ATTRIBUTION`, so the `issue` field cannot separate the two either. Given a component
 * with zero measured true positives, the trade is made in favour of never being wrong: the flagship
 * case it exists for — the standard `ASTM F436` sitting in the QUALITY field — is
 * `extracted_uncatalogued` and passes untouched, and `8.8` on a nut is already caught
 * deterministically by `checkCoherence`. What is genuinely given up is a copied quality that the
 * table recognised and no coherence rule covers.
 */
const PLACED_BY_EXTRACTOR: ReadonlySet<string> = new Set([
  'extracted', 'extracted_uncatalogued',
]);

/**
 * May this verdict downgrade the line? A structural gate, not a nudge.
 *
 * The prompt already tells the critic, in a section of its own, that it does not judge the tables'
 * transformations or the project's declared policies. It does it anyway: the measured downgrades
 * include `GR 2H` "should be INOX" (that is P-3) and `DIN 933` "should be ISO 4014" (that is the §8
 * table, quoted backwards). An instruction a model ignores half the time is not a control, so the
 * rule moves out of the prompt and into code, where it holds every time.
 *
 * A verdict that does not name the attribute it disputes cannot be checked, and an unfalsifiable
 * verdict does not get to send a line to review either. The critic's own charter is attribution —
 * *"in which FIELD it was put and to which ELEMENT it was attributed"* — and naming the field is
 * the cheapest possible evidence that it is talking about attribution at all.
 *
 * What this deliberately does NOT gate: `quantity`, which is not one of the seven attributes and
 * whose contradictions are read straight off the row text ("W/2 HEX. NUT" over 40 studs).
 */
function mayDispute(line: OutputLine, attribute: string | null): boolean {
  if (attribute === 'quantity') return true;
  if (!attribute || !(ATTRIBUTE_KEYS as readonly string[]).includes(attribute)) return false;
  const cell = line.attributes[attribute as (typeof ATTRIBUTE_KEYS)[number]];
  return PLACED_BY_EXTRACTOR.has(cell.provenance);
}

export async function criticiseRow(
  llm: Llm,
  row: MtoRow,
  analysis: Analysis,
  lines: OutputLine[],
  routing: CriticRouting = 'multi_element',
): Promise<CriticResult> {
  if (!needsCritic(analysis, routing) || lines.length === 0) {
    return { lines, ran: false, downgraded: [], missingElements: [], failure: null };
  }

  let res: CriticResponse;
  try {
    const out = await llm.complete<CriticResponse>({
      system: CRITIC_SYSTEM,
      user: `TEXTO ORIGINAL DE LA FILA ${row.itemRef}:\n${row.sourceText}\n\nLÍNEAS PRODUCIDAS:\n${renderLines(lines)}`,
      schema: CRITIC_SCHEMA,
      schemaName: 'critic_verdicts',
      tier: 'critic',
      maxTokens: CRITIC_MAX_TOKENS,
    });
    res = out.data;
  } catch (e) {
    // The critic is a safety net, not a dependency. If it fails, the rules engine's verdict stands:
    // failing the whole row because the optional check broke would be the worse outcome. But it is
    // REPORTED — swallowing it is what let a truncated response look like a clean pass.
    const failure = e instanceof Error ? e.message : String(e);
    return { lines, ran: false, downgraded: [], missingElements: [], failure };
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
    if (!mayDispute(line, v.attribute)) return line;
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
  return { lines: out, ran: true, downgraded, missingElements: missing, failure: null };
}

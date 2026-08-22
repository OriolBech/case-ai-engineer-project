/**
 * Policy-gap detection — the mechanism behind the rules.
 *
 * WHY THIS EXISTS. Every policy in docs/03-policies.md has a default, and a default fires
 * SILENTLY. Faced with a case no policy covers, the pipeline picks the default and resolves the
 * line. On the MTO we were given that is fine, because the policies were written against it. On the
 * next MTO from a different engineering firm — and the client says no two are alike — it is an
 * expensive error delivered with a machine's confidence.
 *
 * The fix is not more rules. It is that the system can say "I have never seen this" instead of
 * resolving it by default, and that the gap becomes a traceable decision rather than a purchase.
 *
 * A gap is NOT a data problem, so it does not go to the buyer's queue. It goes to the policy
 * backlog: decisions the project owes. See docs/12-system-behind-the-rules.md.
 */

import type { MtoRow, OutputLine } from './types.ts';
import { ATTRIBUTE_KEYS } from './types.ts';
import { findNames } from '../rules/names.ts';
import { findStandards } from '../rules/standards.ts';
import { findFinishes } from '../rules/finish.ts';
import { normalizeQuality } from '../rules/quality.ts';
import { deriveMaterial, isDerived } from '../rules/vocabulary-db.ts';

export type GapKind =
  /** The row states a value the deterministic tables recognise, and no output line carries it. */
  | 'UNPLACED_EVIDENCE'
  /** A value in a catalogued position that matches no catalogue entry and no known pattern. */
  | 'UNKNOWN_VALUE'
  /**
   * A quality no vocabulary entry covers, so the material could not be derived.
   *
   * Previously this resolved the line with an empty material and said nothing. It is the clearest
   * example of a default firing quietly: the line looks finished and one of the seven attributes is
   * missing for a reason nobody recorded.
   */
  | 'UNCOVERED_DERIVATION';

export interface PolicyGap {
  kind: GapKind;
  rowRef: string;
  /** Ready-to-paste vocabulary entry, so the decision is one line of JSON away. */
  candidate?: Record<string, unknown>;
  attribute: (typeof ATTRIBUTE_KEYS)[number] | null;
  /** The value that has no home, verbatim. */
  value: string;
  /** What the project owes a decision about, in one sentence. */
  detail: string;
}

/**
 * ASTM-style grades. §5 says a value flagged as a quality but outside the list is extracted as
 * written — a rule clearly written with `GR B7` and `GR 2H` in mind. Anything that does not look
 * like a grade at all is not covered by that rule; it is a gap wearing its costume.
 */
const KNOWN_GRADE = /^(GR\.?\s*)?(B7M?|B16|B8M?|2HM?|2H|4|7|L7|L43|8M?|8[ACM]?)$/i;

/**
 * Compares a row against its own output and reports what the row says but the output does not
 * account for.
 *
 * Deterministic and free: it uses the same closed tables that provide the no-model baseline, so it
 * costs nothing and it runs on every row rather than on a sampled subset.
 *
 * It catches the failure class the span verifier structurally cannot. A model that puts the washer's
 * STANDARD into the quality field passes span verification — the text really is in the row — and
 * fails here, because the standard it should have carried is now unaccounted for.
 *
 * QUALITIES ARE NOT SCANNED, on purpose. §5 is explicit: if it is not known whether a value is
 * flagged as a quality, it is not extracted. A scanner over free text cannot know that, so scanning
 * for qualities would manufacture gaps out of any bare number in the row.
 */
export function detectGaps(row: MtoRow, lines: OutputLine[]): PolicyGap[] {
  const gaps: PolicyGap[] = [];
  if (!lines.length) return gaps;

  // Out-of-family and failed rows are already reported through their own reason; a coverage check
  // over them would just restate it.
  const skip = lines.every((l) =>
    l.reasons.some((r) => r.code === 'OUT_OF_FAMILY' || r.code === 'EMPTY_DESCRIPTION' || r.code === 'PROCESSING_FAILED'));
  if (skip) return gaps;

  const carried = (attr: (typeof ATTRIBUTE_KEYS)[number]): Set<string> =>
    new Set(
      lines
        .flatMap((l) => [l.attributes[attr].normalized, l.attributes[attr].raw])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map((v) => v.toUpperCase()),
    );

  // --- names: a material the row mentions that produced no line ------------
  const namesInRow = new Set(findNames(row.sourceText).map((h) => h.value));
  const namesCarried = carried('name');
  for (const n of namesInRow) {
    if (!namesCarried.has(n.toUpperCase())) {
      gaps.push({
        kind: 'UNPLACED_EVIDENCE', rowRef: row.itemRef, attribute: 'name', value: n,
        detail: `La fila menciona un ${n} que no ha producido ninguna línea.`,
      });
    }
  }

  // --- standards: normalized value, so the same standard written twice counts once ---
  const stdsInRow = new Set(findStandards(row.sourceText).map((s) => s.result.normalized));
  const stdsCarried = carried('standard');
  for (const s of stdsInRow) {
    if (!stdsCarried.has(s.toUpperCase())) {
      gaps.push({
        kind: 'UNPLACED_EVIDENCE', rowRef: row.itemRef, attribute: 'standard', value: s,
        detail: `La fila indica la norma ${s} y ninguna línea la lleva. O falta un elemento, o la norma se ha atribuido a otro atributo.`,
      });
    }
  }

  // --- finishes -----------------------------------------------------------
  const finInRow = new Set(findFinishes(row.sourceText).map((h) => h.value));
  const finCarried = carried('finish');
  for (const f of finInRow) {
    // A finish reported as unattributed (P-1) is accounted for: the decision is recorded.
    const reported = lines.some((l) => l.reasons.some((r) => r.code === 'FINISH_SCOPE_UNSTATED'));
    if (!finCarried.has(f.toUpperCase()) && !reported) {
      gaps.push({
        kind: 'UNPLACED_EVIDENCE', rowRef: row.itemRef, attribute: 'finish', value: f,
        detail: `La fila indica el acabado ${f} y ninguna línea lo lleva ni lo reporta. Un elemento con acabado y el mismo sin acabado son referencias distintas.`,
      });
    }
  }

  // --- qualities outside the catalogue that do not look like a grade -------
  for (const line of lines) {
    const q = line.attributes.quality;
    if (!q.raw) continue;
    const norm = normalizeQuality(q.raw);
    if (norm.inCatalog) continue;
    if (KNOWN_GRADE.test(q.raw.trim())) continue;
    gaps.push({
      kind: 'UNKNOWN_VALUE', rowRef: row.itemRef, attribute: 'quality', value: q.raw,
      detail: `La calidad "${q.raw}" no está en el catálogo ni encaja con un grado conocido. ` +
        'Se resolvería tal cual por §5, que está escrita pensando en grados ASTM; este valor necesita una decisión.',
    });
  }

  // --- qualities the material vocabulary does not cover -------------------
  for (const line of lines) {
    const q = line.attributes.quality;
    if (!q.raw || line.attributes.material.normalized !== null) continue;
    const d = deriveMaterial(q.raw);
    // 'deliberate' está declarada no derivable con su motivo: es una ausencia válida, no un hueco.
    // 'ambiguous' ya manda la línea a revisión en el validador, así que tampoco es una decisión
    // pendiente del proyecto — es una desambiguación pendiente de la tabla, y se ve en la línea.
    if (isDerived(d) || d.reason !== 'uncovered') continue;
    gaps.push({
      kind: 'UNCOVERED_DERIVATION', rowRef: row.itemRef, attribute: 'material', value: q.raw,
      detail: `Ninguna entrada del vocabulario cubre la calidad "${q.raw}", así que la línea sale sin material. ` +
        'Decidir si es AC o INOX, o declararla no derivable con su motivo.',
      candidate: {
        id: `TODO-${q.raw.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        when: { qualityPattern: `^${q.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
        material: 'AC | INOX',
        rationale: 'PENDIENTE',
        decidedBy: 'PENDIENTE',
        decidedAt: 'PENDIENTE',
        source: 'PENDIENTE',
      },
    });
  }

  return gaps;
}

/** Groups gaps into the decisions the project owes, most frequent first. */
export interface PolicyBacklogItem {
  kind: GapKind;
  attribute: string | null;
  value: string;
  detail: string;
  rows: string[];
  candidate?: Record<string, unknown>;
}

export function policyBacklog(gaps: PolicyGap[]): PolicyBacklogItem[] {
  const byKey = new Map<string, PolicyBacklogItem>();
  for (const g of gaps) {
    const key = `${g.kind}|${g.attribute}|${g.value.toUpperCase()}`;
    const item = byKey.get(key);
    if (item) item.rows.push(g.rowRef);
    else byKey.set(key, { kind: g.kind, attribute: g.attribute, value: g.value, detail: g.detail, rows: [g.rowRef], candidate: g.candidate });
  }
  // One decision that unblocks forty rows is worth more than forty decisions that unblock one.
  return [...byKey.values()].sort((a, b) => b.rows.length - a.rows.length);
}

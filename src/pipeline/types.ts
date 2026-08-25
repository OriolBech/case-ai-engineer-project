/**
 * Domain contract for the whole pipeline.
 *
 * This file is the executable version of specs/SPEC-001..007. If a spec and this file
 * disagree, one of them is a bug — fix it in the same commit.
 *
 * Docs (in Spanish, per ADR-001): docs/04-architecture.md
 */

// ---------------------------------------------------------------------------
// Closed catalogues — reglas_tornilleria.md §3, §4, §5, §9
// ---------------------------------------------------------------------------

/** §3. The catalogue does not distinguish subtypes: what differentiates them is the standard. */
export type ItemName = 'TORNILLO' | 'TUERCA' | 'ARANDELA' | 'VARILLA ROSCADA' | 'ESPARRAGO';

/** §7. Length is mandatory for all fastener types except these two. */
export const LENGTH_EXEMPT: readonly ItemName[] = ['TUERCA', 'ARANDELA'];

/** §9. Absence of a finish is a valid value and never sends a line to review. */
export type Finish = string;

/**
 * §5. Two values of the same group are equivalent. Different groups are NOT.
 *
 * The client's fourteen. This is **layer 1**: their document, not ours, and nothing in this codebase
 * edits it.
 */
export type ClientQualityGroup =
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7'
  | 'G8' | 'G9' | 'G10' | 'G11' | 'G12' | 'G13' | 'G14';

/**
 * A group **we** declared, because the value equals nothing in §5.
 *
 * Why this exists. A quality outside §5 used to have exactly one exit in the UI: pick one of the
 * fourteen. For `GR 660` — a nickel-base alloy that is not interchangeable with any of them — that
 * exit is *declaring an equivalence that is false*, and a false equivalence is a worse breach of the
 * group invariant than a new group is: it means someone can be shipped `8.8` where `GR 660` was
 * specified. Finish already had "declare a new one" and material has "not derivable"; this is the
 * same third exit for quality.
 *
 * The `V-` prefix (vocabulario) is load-bearing: a group of ours must never be mistakable for one of
 * §5, in the trace, in the logs, or in a table listing both. Layer 1 stays exactly fourteen.
 */
export type OwnQualityGroup = `V-${string}`;

export type QualityGroup = ClientQualityGroup | OwnQualityGroup;

export type UnitSystem = 'imperial' | 'metric';

// ---------------------------------------------------------------------------
// Provenance — drives the confidence score (SPEC-007) and the trace panel
// ---------------------------------------------------------------------------

export type Provenance =
  /** Appeared literally in the MTO and is in a closed catalogue. */
  | 'exact_catalog'
  /** Alias recognised in one of the client's tables. */
  | 'table_normalized'
  /**
   * Appeared literally, but there is no closed catalogue to check it against: a measure (`M20`),
   * a standard with no equivalence (`DIN 975`), a material written in words (`acero`). As solid as
   * a catalogue hit — the difference is that nothing corroborates it.
   */
  | 'extracted'
  /** Flagged as a quality but outside the list (ASTM grades: GR B7, GR 2H). */
  | 'extracted_uncatalogued'
  /** Measure inherited within a set — the ONLY extrapolation the rules allow (§2). */
  | 'extrapolated'
  /** Material deduced from quality — policy P-3, not a written rule. */
  | 'derived'
  /** Multiplicity or length unit assumed — policies P-2, P-4. */
  | 'inferred'
  /** Not present in the MTO. Nothing a model can fix: goes back to engineering. */
  | 'absent'
  /** The attribute does not apply: length on a nut or a washer (§7). Not a gap. */
  | 'not_applicable'
  /**
   * A person overwrote what the system read — SPEC-015. It is its own provenance rather than a flag
   * on top of the old one, and that is the point: a value typed by a buyer must never be readable as
   * something the MTO said. It is the most trustworthy source in this list (someone looked at the
   * row) and the one the system can least explain, which is exactly why it has to be visible.
   *
   * The pipeline never emits it: it exists only in the session patch and in the corrections log.
   */
  | 'human_corrected';

/** Byte offsets into MtoRow.sourceText. Every non-null value must have one. */
export interface Span {
  start: number;
  end: number;
}

export interface Attribute<T = string> {
  raw: string | null;
  normalized: T | null;
  provenance: Provenance;
  span: Span | null;
  /** Rule or policy that produced the value: 'G3', 'DIN934->ISO4032', 'P-1'. */
  rule: string | null;
}

// ---------------------------------------------------------------------------
// Stage 1 — ingest (SPEC-001)
// ---------------------------------------------------------------------------

export interface MtoRow {
  /** Value of the ITEM column, as written. Not an index. */
  itemRef: string;
  /** All text cells concatenated, verbatim. Every span in the pipeline points here. */
  sourceText: string;
  /** Column name -> offset in sourceText. Headers are metadata, NEVER semantics:
   *  the MTO has a column called MATERIAL that holds quality or standard. */
  cellOffsets: Record<string, Span>;
  quantity: number | null;
  /**
   * Header of the column `quantity` came from, or null when no column identified itself as one.
   * Needed to tell a multiplicity written in the DESCRIPTION ("2 arandelas") from the row's own
   * quantity cell: reading the second as the first multiplies the purchase order. See
   * `analysisFromResponse` in analyze.ts.
   */
  quantityColumn: string | null;
  unit: string | null;
  sheet: string;
  rowNumber: number;
}

// ---------------------------------------------------------------------------
// Stage 2 — set splitter (SPEC-002)
// ---------------------------------------------------------------------------

export type ElementRole = 'principal' | 'secondary';

export interface SetElement {
  id: string;
  rowRef: string;
  role: ElementRole;
  /** Detected term, not yet normalized: 'STUD BOLT', 'Tuerca autoblocante'. */
  detectedName: string;
  span: Span;
  multiplicity: number;
  /** 'W/2 HEX. NUT' is stated; 'with NUT' is not. Policy P-2 decides what to do. */
  multiplicitySource: 'stated' | 'not_stated';
}

// ---------------------------------------------------------------------------
// Stage 3/4 — extraction and normalization (SPEC-003, SPEC-004)
// ---------------------------------------------------------------------------

/** The seven attributes. Order matches reglas_tornilleria.md. */
export interface Attributes {
  name: Attribute<ItemName>;
  material: Attribute<string>;
  quality: Attribute<string>;
  measure: Attribute<string>;
  length: Attribute<string>;
  standard: Attribute<string>;
  finish: Attribute<Finish>;
}

export const ATTRIBUTE_KEYS = [
  'name', 'material', 'quality', 'measure', 'length', 'standard', 'finish',
] as const satisfies readonly (keyof Attributes)[];

// ---------------------------------------------------------------------------
// Stage 5 — validator (SPEC-005)
// ---------------------------------------------------------------------------

export type LineStatus = 'RESUELTA' | 'REVISION_MANUAL';

export type ReasonCode =
  // Missing in source -> back to engineering. No model fixes this.
  | 'QUALITY_MISSING'
  | 'STANDARD_MISSING'
  | 'MEASURE_MISSING'
  | 'LENGTH_MISSING'
  | 'NAME_MISSING'
  | 'QUANTITY_NOT_STATED'
  /** Policy P-9: the row is not a fastener at all. Never force it into one of the five names. */
  | 'OUT_OF_FAMILY'
  /** The row carries no description. Distinct from OUT_OF_FAMILY: nothing was read, not misread. */
  | 'EMPTY_DESCRIPTION'
  /** The model call failed for this row. A processing failure, never a statement about the row. */
  | 'PROCESSING_FAILED'
  /**
   * Policy P-1. The row states a finish but does not say which elements it applies to.
   *
   * Deliberately NOT the same as an absent finish, which §9 declares valid and resolvable. The
   * value is present in the row and unattributed, so both available inferences are wrong: reaching
   * it across the set contradicts "only the measure extrapolates", and calling it absent asserts a
   * bare nut next to a zinc-plated bolt — which the no-mixing rule makes a different material.
   */
  | 'FINISH_SCOPE_UNSTATED'
  /**
   * The extractor returned no elements for a row that has a description and is not out of family.
   *
   * Before this existed the row produced no output line at all and vanished: no material, no
   * reason, nothing to review. A row that disappears is worse than a row extracted wrongly, because
   * nobody knows to look for it.
   */
  | 'NO_ELEMENTS_EXTRACTED'
  // Incoherence -> a human decides.
  | 'QUALITY_TYPE_INCOHERENCE'
  | 'UNIT_MISMATCH'
  | 'LENGTH_UNIT_IMPLAUSIBLE'
  // System uncertainty.
  | 'LOW_CONFIDENCE'
  | 'CRITIC_DISAGREES'
  | 'UNMAPPED_VALUE';

/**
 * The distinction the case statement demands explicitly: it is not the same thing that the
 * MTO does not carry the data as that the system is unsure. The first goes back to
 * engineering; the second a buyer can resolve. The UI shows them as two queues.
 *
 * `OUT_OF_SCOPE` is a third thing, and it is ours, not theirs (P-9). A flange row is not missing
 * anything and the system is not unsure: the row is complete, correct, and none of our business.
 * It was filed under MISSING_IN_SOURCE until we noticed what that implies — sending a perfectly
 * good row back to engineering, who have nothing to fix and will bounce it straight back. That is
 * noise in the one queue the case statement says must stay clean, so it gets its own kind and its
 * own queue.
 */
export type ReasonKind = 'MISSING_IN_SOURCE' | 'INCOHERENCE' | 'LOW_CONFIDENCE' | 'OUT_OF_SCOPE';

export interface Reason {
  code: ReasonCode;
  kind: ReasonKind;
  /** Buyer-facing text. Never show the enum in the UI. */
  message: string;
  attribute: keyof Attributes | null;
}

export interface OutputLine {
  id: string;
  rowRef: string;
  status: LineStatus;
  attributes: Attributes;
  /** quantityRow x multiplicity. See policy P-2. */
  quantity: number | null;
  quantityProvenance: Provenance;
  /** All of them, not just the first: the buyer needs to know how much to fix. */
  reasons: Reason[];
  confidence: number;
  /** Policy ids that shaped this line: ['P-1', 'P-3']. For the challenge. */
  policiesApplied: string[];
}

// ---------------------------------------------------------------------------
// Stage 6 — critic (SPEC-006)
// ---------------------------------------------------------------------------

export interface CriticVerdict {
  lineId: string;
  /** The critic can ONLY downgrade. It never promotes REVISION_MANUAL to RESUELTA. */
  agrees: boolean;
  reason?: Reason;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface ProcessResult {
  lines: OutputLine[];
  rowsIngested: number;
  rowsSkipped: number;
  metrics: {
    latencyMs: number;
    /** In euros. The CFO will do the multiplication; do it first. */
    costEur: number;
    llmCalls: number;
    criticRunRatio: number;
  };
}

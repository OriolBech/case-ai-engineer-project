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
export type Finish =
  | 'GEOMET'
  | 'DACROMET'
  | 'GALVANIZADO EN CALIENTE'
  | 'CINCADO'
  | 'PAVONADO'
  | 'FOSFATADO'
  | 'BICROMATADO';

/** §5. Two values of the same group are equivalent. Different groups are NOT. */
export type QualityGroup =
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7'
  | 'G8' | 'G9' | 'G10' | 'G11' | 'G12' | 'G13' | 'G14';

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
  | 'not_applicable';

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
 */
export type ReasonKind = 'MISSING_IN_SOURCE' | 'INCOHERENCE' | 'LOW_CONFIDENCE';

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

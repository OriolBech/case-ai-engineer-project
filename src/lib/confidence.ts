/**
 * Confidence and the resolved/review threshold. See specs/SPEC-007-confidence.md.
 *
 * The score comes from the PROVENANCE of each value, which is an observable fact of the pipeline —
 * not from asking a model how sure it is, which comes back badly calibrated.
 */

import type { Attributes, OutputLine, Provenance } from '../pipeline/types.ts';
import { ATTRIBUTE_KEYS } from '../pipeline/types.ts';


export const PROVENANCE_SCORE: Record<Provenance, number | null> = {
  exact_catalog: 1.0,
  extracted: 0.95,
  table_normalized: 0.95,
  extracted_uncatalogued: 0.8,
  extrapolated: 0.7,
  derived: 0.55,
  inferred: 0.45,
  /**
   * null = excluded from the aggregation, NOT zero.
   *
   * Scoring absence as zero was wrong and it showed immediately: an absent finish is an explicitly
   * VALID value (§9), so every line without a finish scored 0 and the whole MTO went to review.
   * Absence is the rules engine's business — a missing mandatory attribute already emits a reason.
   * Confidence answers a different question: how sure am I of the values I DID produce.
   */
  absent: null,
  /** A nut has no length (§7). That is not uncertainty either. */
  not_applicable: null,
};

/**
 * The MINIMUM of the attribute scores, not the mean.
 *
 * A mean hides one bad attribute behind six good ones, and one bad attribute is all it takes to buy
 * the wrong material. The asymmetry of the two errors in section 1 of the brief is the whole reason
 * this is a min.
 */
export function scoreLine(attributes: Attributes): number {
  const scores = ATTRIBUTE_KEYS
    .map((k) => PROVENANCE_SCORE[attributes[k].provenance])
    .filter((s): s is number => s !== null);
  return scores.length ? Math.min(...scores) : 0;
}

export interface Thresholds {
  /**
   * The resolved/review boundary, expressed as the WEAKEST provenance acceptable in a RESUELTA
   * line — not as a bare scalar.
   *
   * This is the decision the brief calls the most important one in the case, and it is a business
   * decision, so it has to be sayable in the client's terms. "Is 0.55 the right threshold" is not a
   * conversation a purchasing director can have. "Do you accept a resolved line whose material was
   * derived from the quality, or whose length unit was inferred" is.
   *
   * Default `inferred`: accept everything the declared policies produce, because each of those
   * cases was already argued in docs/03-policies.md. Tightening it to `derived` or `extrapolated`
   * trades autonomy for safety, and the eval harness plots that trade.
   */
  minProvenance: Provenance;
  /** Resolved lines scoring below this go through the critic. Cost knob, not a policy. */
  critic: number;
}

export function thresholds(env: NodeJS.ProcessEnv = process.env): Thresholds {
  const min = (env.THRESHOLD_MIN_PROVENANCE ?? 'inferred') as Provenance;
  return {
    minProvenance: min in PROVENANCE_SCORE ? min : 'inferred',
    critic: Number(env.THRESHOLD_CRITIC ?? 0.9),
  };
}

/** Score floor implied by the accepted provenance. */
export const minAcceptableScore = (t: Thresholds): number => PROVENANCE_SCORE[t.minProvenance] ?? 0;

export type Routing = 'resolve' | 'critic' | 'review';

/** Which of the three bands a line falls into. Only the middle band costs a model call. */
export function route(line: OutputLine, t: Thresholds): Routing {
  if (line.status === 'REVISION_MANUAL') return 'review';
  if (line.confidence < minAcceptableScore(t)) return 'review';
  if (line.confidence < t.critic) return 'critic';
  return 'resolve';
}

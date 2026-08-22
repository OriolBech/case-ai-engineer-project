/**
 * Every decision the client's rules do NOT make. See docs/03-policies.md.
 *
 * Invariant of this project: no implicit behaviour. If the pipeline decides something that is
 * not written in reglas_tornilleria.md and not in this file, it is a bug.
 *
 * All of these are switchable at runtime so the alternative can be demonstrated live during
 * the challenge, together with its delta on the KPI.
 */

export interface Policies {
  /**
   * P-1. A finish written once for a whole set: how far does it reach?
   *
   * ANSWERED BY THE CLIENT (2026-08-22): "solo la medida se extrapola". So the finish does NOT
   * reach the other elements — and, just as importantly, it is not asserted to be absent from them
   * either. Absent and present-but-unattributed are different things: by §9's no-mixing rule,
   * calling it absent changes the reference that gets bought.
   */
  finishSetScope: 'review' | 'whole_set' | 'principal_only';
  /** P-2. Multiplicity not written ('with NUT'): infer it or send to review? */
  implicitMultiplicity: 'infer_one' | 'review';
  /** P-3. Material almost never written; derive AC/INOX from quality? */
  materialDerivation: 'from_quality' | 'off';
  /** P-4. '7/8" X 130' — the 130 carries no unit. */
  unitlessLength: 'plausibility_range' | 'review';
  /** P-5. No written review rule exists for a missing standard. */
  missingStandard: 'review' | 'resolve';
  /** P-6. Nut with quality 8.8 (G5) vs nut class 8 (G8). NEVER convert between groups. */
  qualityCoherence: 'review' | 'ignore';
  /**
   * P-8. The rules restrict `8`/`10` to nuts but say nothing about the HV hardness groups.
   * Default resolves them: inventing a restriction the client did not write is what §1 forbids.
   */
  hvScope: 'anywhere' | 'washer_only';
  /**
   * P-9. A row that is not a fastener (a flange, a gasket). The worst failure mode in the case is
   * emitting seven plausible attributes for one of these as RESUELTA, so the default surfaces it.
   */
  outOfFamily: 'review' | 'silent_skip';
}

/**
 * Defaults declared to the client in docs/client-questions/email-001.md.
 * If an answer arrives, update docs/03-policies.md and mark the policy confirmed —
 * but keep the flag, so the alternative stays demonstrable.
 */
export const DEFAULT_POLICIES: Policies = {
  finishSetScope: 'review',
  implicitMultiplicity: 'infer_one',
  materialDerivation: 'from_quality',
  unitlessLength: 'plausibility_range',
  missingStandard: 'review',
  qualityCoherence: 'review',
  hvScope: 'anywhere',
  outOfFamily: 'review',
};

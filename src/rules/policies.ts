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
  /**
   * P-10. A bare number in the measure field of an element that shares a row with a well-formed
   * measure. §6 admits only inches and metric and denies any equivalence between them, and §2 makes
   * the measure the one thing that travels across a set — so a nut in an M20 set is M20, never
   * "10". Default rejects it and lets §2 extrapolate.
   */
  bareMeasureInSet: 'reject' | 'keep';
  /**
   * P-11. What to do with the value P-10 just rejected. When it is a catalogue quality and it is
   * coherent with this element's type, it is that element's quality — a closed-table reading, not
   * a guess. Default recovers it; 'off' drops it and the line goes to review as QUALITY_MISSING.
   */
  rejectedMeasureAsQuality: 'if_catalog_and_coherent' | 'off';
  /**
   * P-12. A finish the vocabulary does not recognise. Default `review`: §9 says an item with a
   * finish and the same item without one are different references, so an unknown finish must not
   * ship as RESUELTA (the buyer would export an RFQ with the wrong part). The gap still lands in
   * the backlog so the vocabulary decision is taken once, not once per row. `resolve` is the
   * published-KPI ablation (line resolves as if it had no finish). See specs/SPEC-011-finish-vocabulary.md.
   */
  unknownFinish: 'review' | 'resolve';
  /**
   * P-13. A quality **no vocabulary entry covers**, so the material could not be derived.
   *
   * Not a new question: it is the second half of the answer already given to the client for Q3 —
   * *"cualquier calidad no cubierta o no unívoca irá a revisión"* (`src/rules/vocabulary-db.ts`).
   * The validator applied the "no unívoca" half and not the "no cubierta" one, so a line with an
   * empty material shipped as RESUELTA and was exported to the RFQ. Measured on
   * `MTO_sugerencias.xlsx`: 6 of 42 lines, every one of them a quality nobody had decided on.
   *
   * The gap still goes to the policy backlog — it is a decision the project owes, taken once, not
   * once per row (SPEC-011 sets the precedent for finish with P-12). What changes is the line's
   * STATUS: those are two different channels, and confusing them is what let the default fire
   * silently. `resolve` is the ablation that restores the previous behaviour so its delta stays
   * measurable. A `deliberate` absence (`200HV`: hardness does not name a base metal) is a decided,
   * valid absence and is NOT affected by this policy.
   */
  uncoveredMaterial: 'review' | 'resolve';
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
  bareMeasureInSet: 'reject',
  rejectedMeasureAsQuality: 'if_catalog_and_coherent',
  unknownFinish: 'review',
  uncoveredMaterial: 'review',
};

// ---------------------------------------------------------------------------
// Los flags, conectados de verdad
// ---------------------------------------------------------------------------

/**
 * Lectura de las políticas desde el entorno.
 *
 * Existía la documentación y no existía el mecanismo: `.env.example` listaba diez `POLICY_*` bajo el
 * rótulo "conmutables en caliente durante el challenge", `03-policies.md` daba a cada política su
 * flag, y **ninguno se leía en ninguna parte**. `processMto` aceptaba `opts.policies` y lo pasaba
 * bien hasta el validador, pero ningún llamador lo rellenaba. Cambiar el `.env` no hacía nada.
 *
 * Dos decisiones sobre cómo se lee, y las dos son el mismo principio del proyecto:
 *
 * **Un valor inválido revienta, no cae al default.** `POLICY_MISSING_STANDARD=revisar` (en vez de
 * `review`) tiene que parar la ejecución con el listado de valores admitidos. Caer al default sería
 * un default disparándose en silencio, que es literalmente el modo de fallo que este fichero existe
 * para evitar — y encima con el operador convencido de que cambió algo.
 *
 * **Se devuelve qué se cambió, no sólo el resultado.** Una medida tomada con políticas distintas de
 * las publicadas no es comparable con las cifras del 2-pager, así que la ejecución tiene que poder
 * decirlo. Es la misma lección que el crítico que se caía sin avisar: el número no vale si no viene
 * con las condiciones en que se tomó.
 */
interface PolicySpec {
  env: string;
  values: readonly string[];
}

const SPEC: { [K in keyof Policies]: PolicySpec } = {
  finishSetScope: { env: 'POLICY_FINISH_SET_SCOPE', values: ['review', 'whole_set', 'principal_only'] },
  implicitMultiplicity: { env: 'POLICY_IMPLICIT_MULTIPLICITY', values: ['infer_one', 'review'] },
  materialDerivation: { env: 'POLICY_MATERIAL_DERIVATION', values: ['from_quality', 'off'] },
  unitlessLength: { env: 'POLICY_UNITLESS_LENGTH', values: ['plausibility_range', 'review'] },
  missingStandard: { env: 'POLICY_MISSING_STANDARD', values: ['review', 'resolve'] },
  qualityCoherence: { env: 'POLICY_QUALITY_COHERENCE', values: ['review', 'ignore'] },
  hvScope: { env: 'POLICY_HV_SCOPE', values: ['anywhere', 'washer_only'] },
  outOfFamily: { env: 'POLICY_OUT_OF_FAMILY', values: ['review', 'silent_skip'] },
  bareMeasureInSet: { env: 'POLICY_BARE_MEASURE_IN_SET', values: ['reject', 'keep'] },
  rejectedMeasureAsQuality: { env: 'POLICY_REJECTED_MEASURE_AS_QUALITY', values: ['if_catalog_and_coherent', 'off'] },
  unknownFinish: { env: 'POLICY_UNKNOWN_FINISH', values: ['review', 'resolve'] },
  uncoveredMaterial: { env: 'POLICY_UNCOVERED_MATERIAL', values: ['review', 'resolve'] },
};

export interface PolicyOverride {
  policy: keyof Policies;
  env: string;
  value: string;
  fallback: string;
}

export interface ResolvedPolicies {
  policies: Policies;
  /** Vacío en una ejecución normal. Si trae algo, la medida no es comparable con las publicadas. */
  overrides: PolicyOverride[];
}

export function policiesFromEnv(env: Record<string, string | undefined> = process.env): ResolvedPolicies {
  const policies = { ...DEFAULT_POLICIES };
  const overrides: PolicyOverride[] = [];

  for (const key of Object.keys(SPEC) as (keyof Policies)[]) {
    const spec = SPEC[key];
    const raw = env[spec.env]?.trim();
    if (!raw) continue;
    if (!spec.values.includes(raw)) {
      throw new Error(
        `${spec.env}="${raw}" no es un valor válido. Admitidos: ${spec.values.join(' | ')}. ` +
        `Ver docs/03-policies.md#${String(key).toLowerCase()}.`,
      );
    }
    const fallback = DEFAULT_POLICIES[key] as string;
    if (raw === fallback) continue;
    (policies as Record<string, string>)[key] = raw;
    overrides.push({ policy: key, env: spec.env, value: raw, fallback });
  }

  return { policies, overrides };
}

/** Una línea legible para las cabeceras de los scripts y del front. */
export function describeOverrides(overrides: PolicyOverride[]): string {
  return overrides.map((o) => `${o.policy}: ${o.fallback} -> ${o.value}`).join(' · ');
}

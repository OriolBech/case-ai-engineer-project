# ADR-002 · Selection criteria for the 3 questions to the client

- **Date**: 2026-08-20
- **Status**: accepted

## Context

The case allows **a maximum of 3 questions** and warns that "one smart question tells us more
than one made-up answer." `reglas_tornilleria.md` §10 deliberately leaves 6 points open, plus 1
internal contradiction we detected ourselves: 7 candidates for 3 slots.

## Decision

An ambiguity earns a slot **only if it meets all three conditions**:

1. **There's no defensible unilateral criterion** — either both options are bad, or the good one
   depends on information only the client has.
2. **"Send it to review" isn't an escape hatch** — either because it affects enough volume that
   review kills the product, or because the error materializes as the wrong material on site.
3. **The answer changes the blind set's output.**

Selected: **P-1** (finish on sets), **P-2** (unstated multiplicity), **P-3** (derived material).
See `docs/client-questions/email-001.md`.

Also: all three are sent **on day 0**, in a single email, **closed-ended and with the default
stated** ("if you don't tell me otherwise, I'll assume X"). Three advantages: answering takes 30
seconds, it demonstrates judgment instead of delegating the decision, and if there's no answer
there's no blocker.

## Alternatives discarded

| Candidate | Why it doesn't cost a slot |
|---|---|
| **P-4 Length with no unit** | Defensible physical criterion: 130″ is 3.3 m. Plausibility range, and out-of-range goes to review. Fails condition 1. |
| **P-5 Line with no standard** | The rules contain the argument (§3: "what tells them apart is the standard"). Fails condition 1. |
| **P-6 Nut with quality 8.8** | The brief already gives the answer: review is for "a required field is missing **or there's an inconsistency**." It's a planted case. Asking about it is the wrong signal. |
| **P-7 §5 contradiction** | Reconciled as two different moments (system sends to review / person decides). Mentioned in the session. |
| **How to build the gold set / where to set the threshold** | The brief explicitly says these are our own decisions, and half the session's conversation covers them. Asking about them is punting. |
| **Current human error rate** | Fourth in the ranking, and the only one in doubt. Discarded because the evaluation criteria list it as "a problem that isn't technically yours": they want to see how its absence is handled. Resolved by measuring my own self-consistency when labeling and using it as a bound. |
| **The KPI typo** ("it's a good KPI") | Contradicts the whole of section 1; the correct reading is obvious. Mentioned in passing in the session. |

## Consequences

If the client answers, three policies move from default to confirmed and the KPI is reported
without a sensitivity analysis on those three axes. If they don't answer, the three defaults are
written, switchable by flag, and the KPI delta for each alternative is demonstrable live.

# ADR-002 · Selection criteria for the 3 questions to the client

- **Date**: 2026-08-20
- **Status**: accepted, revised the same day (see Revision at the end: 3 questions → 2)

## Context

The case allows **a maximum of 3 questions** and warns that "a smart question tells us more than
a made-up answer." `reglas_tornilleria.md` §10 deliberately leaves 6 points open, plus 1 internal
contradiction we detected: 7 candidates for 3 slots.

## Decision

An ambiguity earns a slot **only if it meets all three conditions**:

1. **There's no defensible unilateral criterion** — either both options are bad, or the good one
   depends on information only the client has.
2. **"Send it to manual review" isn't an escape hatch** — either because it affects so much volume
   that review kills the product, or because the error materializes as the wrong material on site.
3. **The answer changes the blind-set output.**

Selected: **P-1** (finish scope in sets), **P-2** (unwritten multiplicity), **P-3** (derived
material). See `docs/client-questions/email-001.md`.

Also: all three are sent **on day 0**, in a single email, **closed and with the default stated**
("if you don't tell me otherwise, I'll assume X"). Three advantages: answering costs 30 seconds,
it demonstrates judgment instead of delegating the decision, and if there's no answer there's no
blocker.

## Alternatives discarded

| Candidate | Why it doesn't spend a slot |
|---|---|
| **P-4 Length without a unit** | Defensible physical criterion: 130″ is 3.3 m. Plausibility range, and out-of-range goes to review. Fails condition 1. |
| **P-5 Line without a standard** | The rules already contain the argument (§3: "what tells them apart is the standard"). Fails condition 1. |
| **P-6 Nut with 8.8 quality** | The brief already gives the answer: review is for "a required field is missing **or there's an incoherence**." It's a planted case. Asking it is the opposite signal. |
| **P-7 §5 contradiction** | Reconciled as two moments (system sends to review / person decides). Mentioned in the session. |
| **How to build the gold set / where the threshold goes** | The brief explicitly says these are our own decisions and half the point of the session. Asking them would be abdicating. |
| **Current human error rate** | Fourth in the ranking, and the only one debated. Discarded because the evaluation criteria list it as "a problem that isn't technically yours": they want to see how its absence is handled. It's resolved by measuring our own labeling self-consistency and using it as a bound. |
| **The KPI typo** ("it's a good KPI") | Contradicts the whole of section 1; the correct reading is obvious. Mentioned in passing in the session. |

## Consequences

If the client responds, three policies move from default to confirmed and the KPI is reported
without sensitivity analysis on those three axes. If not, all three defaults are written down,
switchable via flag, and the KPI delta of each alternative is demonstrable live.

---

## Revision · 2026-08-20, same day

**Selected went from three to two.** Reviewing the email before sending it, the observation was
that the three candidates fit suspiciously well with the three available slots: *there were 3
slots and 3 got filled*, which is budget bias, not a criterion. Checked one by one against the
three conditions above, **P-2 (unwritten multiplicity) fails them**: quantity isn't one of the
seven attributes, written multiplicity is used and unwritten multiplicity isn't invented, so
there's a defensible unilateral criterion and it fails condition 1.

**Sent**: two questions — #1 the derived material (P-3), #2 the finish scope (P-1). The third
slot is explicitly held back, and the reason is written into the email itself: *"I'm keeping one
for when I'm implementing, which is when the things I don't see today usually surface."*

## Revision · 2026-08-23, closing

**The third slot isn't spent.** The bar was set by the email itself, so the question is whether
implementation uncovered something day 0 couldn't see and that can't be closed unilaterally. It
uncovered three things —P-10, P-11, and a critic that was getting truncated— and all three are
closed either by the client's rules or as our own bugs. The breakdown, with the candidates
evaluated and why each one fails, is in `../client-questions/answers.md` §"Remaining slot".

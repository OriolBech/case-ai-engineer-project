# Policies · What the client's rules don't decide

The six ambiguities from section 10 of `reglas_tornilleria.md`, plus the ones we detected
ourselves. Each one has: decision, discarded alternative, flag that toggles it, and volume
affected on the 15-row MTO.

**Project invariant**: none of this is resolved implicitly in the code. If a behavior is not in
this table, it's a bug.

| ID | Ambiguity | Asked? | Flag |
|---|---|---|---|
| P-1 | Scope of the finish within a set | ✅ Q1 | `POLICY_FINISH_SET_SCOPE` |
| P-2 | Unwritten multiplicity | ✅ Q2 | `POLICY_IMPLICIT_MULTIPLICITY` |
| P-3 | Material not written in the MTO | ✅ Q3 | `POLICY_MATERIAL_DERIVATION` |
| P-4 | Length without unit | ❌ own decision | `POLICY_UNITLESS_LENGTH` |
| P-5 | Line without standard | ❌ own decision | `POLICY_MISSING_STANDARD` |
| P-6 | Quality/type incoherence (8.8 nut) | ❌ already answered by the case statement | `POLICY_QUALITY_COHERENCE` |
| P-7 | §5 internal contradiction (missing quality) | ❌ own decision | — |
| P-8 | HV hardness values outside washers | ❌ own decision | `POLICY_HV_SCOPE` |
| P-9 | Row that isn't fastening hardware | ❌ own decision | `POLICY_OUT_OF_FAMILY` |

---

## P-1 · Scope of the finish within a set

**Problem.** The finish is written once at the row level (`...con tuerca DIN 934 y arandela
DIN 125, 8.8, zincado`) and the rules only cover extrapolating the measure. Under the rule of not
mixing finishes, the answer **changes which material is being purchased**.

**Why it's the most delicate of the three.** Both options are bad: extrapolating contradicts the
written rule; not extrapolating produces a physically inconsistent set (a zinc-plated bolt + a
bare nut) that is, moreover, a different material.

**Decision (default, pending client response).** The finish written at the row level applies to
**all elements of the set**, with `provenance: "extrapolated"`. Reasoning: the finish is a
specification of the functional assembly, and a mixed set is not purchasable.

**Alternative.** `POLICY_FINISH_SET_SCOPE=principal_only` → only the principal element; the rest
comes out without a finish. `=review` → the rest goes to review.

**Volume.** 4/15 rows (26%): rows 4, 6, 8, 9.

**Verifiable in the challenge.** Toggle the flag live and show the KPI delta.

---

## P-2 · Unwritten multiplicity

**Problem.** `W/2 HEX. NUT` is explicit; `with NUT` and `con tuerca y arandela` are not. The rules
literally say "Quantities. No rules." And the quantity **is not one of the seven attributes**, but
without it the line can't be purchased: it's unclear whether it blocks `RESUELTA`.

**Decision (default).** Multiplicity **1** when not written, **2** for stud nuts (evidence from
rows 1 and 5), with `provenance: "inferred"`. **Does not block resolution**, but is flagged in the
front end and can be confirmed in bulk.

**Alternative.** `POLICY_IMPLICIT_MULTIPLICITY=review` → an unwritten quantity sends the line to
review with reason `QUANTITY_NOT_STATED`.

**Volume.** 3–4/15 rows: 2, 3, 8.

---

## P-3 · Unwritten material

**Problem.** The MTO almost never writes the material; the `MATERIAL` column contains the quality
grade or the standard. The rules say to extract what appears and give no derivation rule.

**Decision (default).** Derive `AC`/`INOX` from the quality grade (`A2*`/`A4*`/`304`/`316`/`18-8` →
`INOX`; `8.8`/`10.9`/`12.9`/`GRADE *`/`8`/`10` → `AC`), with `provenance: "derived"` and a trace to
the value that justifies it. **Does not block resolution.** ASTM grades (`B7`, `2H`) → `AC` by the
standard.

**Alternative.** `POLICY_MATERIAL_DERIVATION=off` → missing material sends to review. Expected
effect: autonomy drops to ~0%, which demonstrates why the question mattered.

**Volume.** 14/15 rows. Only row 14 writes `acero` (steel).

---

## P-4 · Length without unit

**Problem.** `7/8" X 130`: the 130 carries no unit.

**Own decision, in two cases that are not the same.**

- **Metric** (`M20x90`, `M12 x 50`): no ambiguity. It's the ISO designation and the second number
  is millimeters. `provenance: "extracted"`, a **certain** cell, does not depend on this policy.
- **Imperial** (`7/8" X 130`): here, yes. A table of plausibility ranges by size, applied wholesale,
  not row by row: 130 inches is 3.3 m, which doesn't exist on a 7/8" stud → mm, with
  `provenance: "inferred"`. What falls outside the range **is not resolved incorrectly**: it goes
  to review with `LENGTH_UNIT_IMPLAUSIBLE`.

**Volume.** Only 3 of the 30 lines in the gold set (rows 1, 5, and 12). With
`POLICY_UNITLESS_LENGTH=review` autonomy drops from 50% to 40%.

**Why it wasn't asked.** There is a defensible, verifiable unilateral criterion (physical range),
and the pathological case falls to review rather than being resolved incorrectly.

---

## P-5 · Line without standard

**Problem.** The only written review rule is the one for the quality grade. There is none for a
missing standard.

**Own decision.** No standard → `REVISION_MANUAL`, reason `STANDARD_MISSING`. Grounded in the
rules themselves: §3 says the catalog doesn't distinguish subtypes and that *"what differentiates
them is the standard"*. Without a standard there's no reference to give a supplier.

**Why it wasn't asked.** The client's rules contain the argument. It also settles row 3 on its own
(`con tuerca y arandela`, without its own standard or quality grade).

---

## P-6 · Quality/type incoherence

**Problem.** It's written that `8` and `10` only apply to nuts; not the reverse, and the MTO has
a nut with quality grade `8.8` (rows 11 and 13).

**Own decision.** `REVISION_MANUAL`, reason `QUALITY_TYPE_INCOHERENCE`. **Never** normalize
`8.8`→`8` on nuts: they are different equivalence groups (G5 vs G8), and silently changing the
specification is exactly the costly error.

**Why it wasn't asked.** The case statement already gives the answer: `REVISION_MANUAL` is for
"a mandatory attribute is missing **or there is an incoherence**." It's a planted case to see if
it's detected.

---

## P-7 · Internal contradiction about missing quality

**Problem.** §5 says "if the Quality field is missing, the item is classified as manual review"
and two lines later "if it isn't entered, the element is allowed to be created without a quality."

**Own decision.** These are two separate moments, not a contradiction: **the system** sends to
review with reason `QUALITY_MISSING`; **the person** decides in the front end whether to create the
element without a quality grade. The front end implements that action explicitly ("create without
quality") and logs it.

---

## P-8 · HV hardness values outside washers

**Problem.** Detected while building the coverage matrix (`09-coverage-and-blind-set.md`), not
listed in section 10. The five `HV` quality grades (100/140/160/200/300) are hardness values, in
practice for washers. The rules explicitly restrict `8` and `10` to nuts, but **say nothing about
HV values**. By the letter, a bolt with `200HV` is resolvable.

**Own decision.** It is resolved, not sent to review. Argument: the explicit restriction of
`8`/`10` proves the rules know how to express a type-based restriction when they want to; their
silence on HV values is information, not an oversight. Inventing a restriction the client didn't
write is exactly what section 1 prohibits.

**Alternative.** `POLICY_HV_SCOPE=washer_only` → HV outside a washer flags
`QUALITY_TYPE_INCOHERENCE`.

**Volume.** 0/15 rows of the given MTO. 1 row of the synthetic set (C3).

---

## P-9 · Row that isn't fastening hardware

**Problem.** Detected while building the matrix. The rules assume everything that comes in belongs
to the family. There's no rule for a flange, a gasket, or a pipe. **This is the worst failure mode
in the entire case**: seven plausible attributes invented on a row that isn't a fastener, coming
out as `RESUELTA` — literally "buying the wrong material with a machine's confidence."

**Own decision.** Third-party status for internal purposes, presented as `REVISION_MANUAL` with
reason `OUT_OF_FAMILY` and `kind: MISSING_IN_SOURCE`: it's not that the system is unsure, it's
that the row isn't its responsibility. In the front end it goes to a separate queue: *"this isn't
fastening hardware, I don't process it."* **Never** forced into one of the five catalog names.

**Why it isn't asked (yet).** There is a defensible, conservative unilateral criterion. But it's
the best candidate for one of the two reserved slots if a nuance emerges during implementation
that can't be closed on its own — for example, if the client expects those rows to be silently
ignored rather than showing up in a queue.

**Alternative.** `POLICY_OUT_OF_FAMILY=silent_skip` → it is discarded and only counted in the
report.

**Volume.** 0/15 rows of the given MTO. 2 rows of the synthetic set (I1, I2), and **bet #12 for
the blind set**.

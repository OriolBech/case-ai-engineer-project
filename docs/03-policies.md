# Policies · What the client's rules don't decide

The six ambiguities in section 10 of `reglas_tornilleria.md`, plus the ones we detected ourselves.
Each one has: decision, discarded alternative, the flag that toggles it, and the volume affected
on the 15-row MTO.

**Project invariant**: none of this is resolved implicitly in the code. If a behavior isn't in
this table, it's a bug.

| ID | Ambiguity | Asked? | Flag |
|---|---|---|---|
| P-1 | Scope of finish within a set | ✅ Q1 | `POLICY_FINISH_SET_SCOPE` |
| P-2 | Unwritten multiplicity | ✅ Q2 | `POLICY_IMPLICIT_MULTIPLICITY` |
| P-3 | Material not written in the MTO | ✅ Q3 | `POLICY_MATERIAL_DERIVATION` |
| P-4 | Length with no unit | ❌ our own decision | `POLICY_UNITLESS_LENGTH` |
| P-5 | Line with no standard | ❌ our own decision | `POLICY_MISSING_STANDARD` |
| P-6 | Quality/type incoherence (8.8 nut) | ❌ already answered by the brief | `POLICY_QUALITY_COHERENCE` |
| P-7 | Internal contradiction in §5 (absent quality) | ❌ our own decision | — |
| P-8 | HV hardnesses outside a washer | ❌ our own decision | `POLICY_HV_SCOPE` |
| P-9 | Row that isn't fastener hardware | ❌ our own decision | `POLICY_OUT_OF_FAMILY` |

---

## P-1 · Scope of finish within a set

**Problem.** The finish is written once at row level (`...with DIN 934 nut and DIN 125 washer,
8.8, zinc-plated`) and the rules only consider extrapolating the measure. Under the no-mixing-
finishes rule, the answer **changes the material actually purchased**.

**Why it's the trickiest of the three.** Both options are bad: extrapolating contradicts the
written rule; not extrapolating produces a physically inconsistent set (zinc-plated bolt + bare
nut) that is, moreover, a different material.

**Decision (default, pending the client's answer).** The finish written at row level reaches
**every element in the set**, with `provenance: "extrapolated"`. Rationale: the finish is a
specification of the functional assembly, and a mixed-finish set isn't purchasable.

**Alternative.** `POLICY_FINISH_SET_SCOPE=principal_only` → only the main element; the rest come
out with no finish. `=review` → the rest go to review.

**Volume.** 4/15 rows (26%): rows 4, 6, 8, 9.

**Verifiable in the challenge.** Toggle the flag live and show the KPI delta.

---

## P-2 · Unwritten multiplicity

**Problem.** `W/2 HEX. NUT` is explicit; `with NUT` and `con tuerca y arandela` are not. The rules
literally say "Quantities. No rules." And quantity **is not one of the seven attributes**, but
without it the line can't be purchased: it isn't clear whether it blocks `RESUELTA`.

**Decision (default).** Multiplicity **1** when not written, **2** for stud-bolt nuts (evidence
from rows 1 and 5), with `provenance: "inferred"`. **Doesn't block resolution**, but is flagged on
the front end and can be confirmed in bulk.

**Alternative.** `POLICY_IMPLICIT_MULTIPLICITY=review` → an unwritten quantity sends the line to
review with reason `QUANTITY_NOT_STATED`.

**Volume.** 3–4/15 rows: 2, 3, 8.

---

## P-3 · Material not written

**Problem.** The MTO almost never writes the material; the `MATERIAL` column contains quality or
standard instead. The rules say to extract what appears and give no derivation rule.

**Decision (default).** Derive `AC`/`INOX` from the quality (`A2*`/`A4*`/`304`/`316`/`18-8` →
`INOX`; `8.8`/`10.9`/`12.9`/`GRADE *`/`8`/`10` → `AC`), with `provenance: "derived"` and a trace to
the value that justifies it. **Doesn't block resolution.** ASTM grades (`B7`, `2H`) → `AC` from
the standard.

**Alternative.** `POLICY_MATERIAL_DERIVATION=off` → an absent material sends the line to review.
Expected effect: autonomy drops to ~0%, which demonstrates why the question mattered.

**Volume.** 14/15 rows. Only row 14 writes `acero` (steel).

---

## P-4 · Length with no unit

**Problem.** `7/8" X 130`: the 130 carries no unit.

**Our own decision.** Physical plausibility range: 130 inches is 3.3 m, absurd for a stud bolt. A
table of ranges by measure is applied; within range → `mm` with `provenance: "inferred"`; out of
range → review with reason `LENGTH_UNIT_IMPLAUSIBLE`.

**Why it wasn't asked.** There's a defensible, verifiable unilateral criterion (physical range),
and the pathological case falls into review instead of being resolved incorrectly.

---

## P-5 · Line with no standard

**Problem.** The only written review rule is the one for quality. There is none for a missing
standard.

**Our own decision.** No standard → `REVISION_MANUAL`, reason `STANDARD_MISSING`. Grounded in the
client's own rules: §3 says the catalog doesn't distinguish subtypes and that *"what tells them
apart is the standard."* With no standard there's no reference to give a supplier.

**Why it wasn't asked.** The client's rules contain the argument. It also closes row 3 on its own
(`con tuerca y arandela`, with no standard or quality of its own).

---

## P-6 · Quality/type incoherence

**Problem.** It's written that `8` and `10` only apply to nuts; not the reverse, and the MTO
brings a nut with quality `8.8` (rows 11 and 13).

**Our own decision.** `REVISION_MANUAL`, reason `QUALITY_TYPE_INCOHERENCE`. **Never** normalize
`8.8`→`8` on nuts: they are different equivalence groups (G5 vs G8), and silently changing the
specification is exactly the expensive error.

**Why it wasn't asked.** The brief already gives the answer: `REVISION_MANUAL` is for "a mandatory
attribute is missing **or there is an incoherence**." It's a planted case to see if it gets caught.

---

## P-7 · Internal contradiction about absent quality

**Problem.** §5 says "if the Quality field is missing, the item is classified as manual review"
and two lines later, "if it isn't entered, the element is allowed to be created with no quality."

**Our own decision.** These are two different moments, not a contradiction: **the system** sends
it to review with reason `QUALITY_MISSING`; **the person** decides on the front end whether to
create the element with no quality. The front end implements that action explicitly ("create with
no quality") and logs it.

---

## P-8 · HV hardnesses outside a washer

**Problem.** Detected while building the coverage matrix (`09-coverage-and-blind-set.md`), not
listed in section 10. The five `HV` qualities (100/140/160/200/300) are hardnesses, in practice
found on washers. The rules explicitly restrict `8` and `10` to nuts, but **say nothing about
HV**. By the letter, a bolt with `200HV` is resolvable.

**Our own decision.** It's resolved, not sent to review. Argument: the explicit `8`/`10`
restriction shows the rules know how to express a per-type restriction when they want to; its
absence for HV is information, not an oversight. Inventing a restriction the client didn't write
is exactly what section 1 forbids.

**Alternative.** `POLICY_HV_SCOPE=washer_only` → HV outside a washer flags
`QUALITY_TYPE_INCOHERENCE`.

**Volume.** 0/15 rows in the given MTO. 1 row in the synthetic set (C3).

---

## P-9 · Row that isn't fastener hardware

**Problem.** Detected while building the matrix. The rules assume everything that comes in
belongs to the family. There's no rule for a flange, a gasket, or a pipe. **This is the worst
failure mode in the whole case**: seven plausible invented attributes on a row that isn't a
fastener, coming out as `RESUELTA` — literally "buying the wrong material with a machine's
confidence."

**Our own decision.** A third state for internal purposes, presented as `REVISION_MANUAL` with
reason `OUT_OF_FAMILY` and `kind: MISSING_IN_SOURCE`: it's not that the system is unsure, it's that
the row isn't within its remit. On the front end it goes to a separate queue: *"not fastener
hardware, not processing it."* The five catalog names are **never** forced onto it.

**Why it isn't asked (yet).** There's a defensible unilateral criterion and it's the conservative
one. But it's the best candidate for one of the two reserved slots if a nuance turns up during
implementation that can't be closed on its own — for example, if the client expects those rows to
be silently ignored instead of showing up in a queue.

**Alternative.** `POLICY_OUT_OF_FAMILY=silent_skip` → it's discarded and only counted in the
report.

**Volume.** 0/15 rows in the given MTO. 2 rows in the synthetic set (I1, I2), and **bet #12 for
the blind set**.

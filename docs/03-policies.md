# Policies · What the client's rules don't decide

The six ambiguities from section 10 of `reglas_tornilleria.md`, plus the ones we detected
ourselves. Each one has: a decision, the discarded alternative, the flag that switches it, and the
volume affected on the 15-row MTO.

**Project invariant**: none of this is resolved implicitly in the code. If a behavior isn't in
this table, it's a bug.

---

## What kind of object a policy is

This document had eleven well-argued policies and didn't say **what a policy is**, which turned
out to be the useful question the day it had to be decided whether the material vocabulary
covered everything. Now there are **twelve**: P-12 (unrecognized finish) closes the silent gap in
§9.

There are **three distinct objects**, and confusing them is what leads to lumping them into the
same table:

| | What it decides | Example |
|---|---|---|
| **Client catalog** | What their document says | The 5 names, the 25 DIN→ISO equivalences |
| **Vocabulary** | **Values**: this token means this value | `ZP → CINCADO`, `A4-70 → INOX` |
| **Policy** | **Behavior**: what to do when the rules stay silent | No standard → review (P-5) |

The catalog belongs to the client and isn't touched from here. The other two are ours, both carry
who/when/why, and yet **they shouldn't share a home**, because they aren't approved the same way:

| | Vocabulary | Policy |
|---|---|---|
| Blast radius | Local: only the rows carrying that token | Global: changes the state of an entire class of lines |
| What makes it approvable | The ambiguity guard: *does it break anything it already resolves?* | **The KPI delta**: *how many lines does it move, and in which direction?* |
| Who can sign off on it | An experienced buyer | Whoever is accountable for the cost of the error |
| Cadence | Continuous, dozens a month | Rare, and every change is an event |

The second row is the one that matters. **What makes a policy approvable isn't the input, it's
the delta.** The vocabulary form asks *"AC or INOX?"*; a policy console has to answer *"what
happens to my numbers if I change this?"* That's why it can't be the same screen.

### Scope, which doesn't exist yet

All twelve policies are **global**. And the brief says part of the engineering work is in-house
and part is outsourced, and that *each one writes the same nut differently*. That points to a
fourth object this project doesn't have:

- **Convention** — how **this source** writes things. *"Studio A never writes the standard on
  threaded rods."* *"Studio B puts the quality grade in the MATERIAL column."* Many per issuer,
  and it's what turns silent drift (`06-production-risks.md` §2) into something expected rather
  than a surprise.

The case that uncovered it: *"for VARILLA ROSCADA (threaded rod), when there's no standard, the
DIN 975/976 family is assumed."* It's not global — it doesn't hold for a bolt, where without a
standard you can't tell DIN 931 from DIN 933 — nor is it specific to one issuer. It's a policy
**scoped by type**, and the moment you try to write it down you see policies are missing that
dimension.

**What's being deferred is acting, not observing.** Until today this paragraph lumped both things
together, which is why the price looked prohibitive:

- **Observing** — stamping the issuer on every gap and every line sent to review. It's one more
  field on the provenance that already exists, and **it doesn't break comparability**: it
  decomposes the KPI, the global figure stays the aggregate. It's also what makes the gap rate
  mean something, because without the issuer the learning curve averages populations the client
  says are different (`11-system-behind-the-rules.md` §4).
- **Acting** — policies scoped by issuer. That does multiply the configuration surface and
  **breaks the KPI's comparability**: you stop having a single publishable number and end up with
  one per studio. It's not being built now, and it goes to `07-target-solution.md` §4 with that
  price attached.

The order matters: acting without having observed first is configuring by hunch. A convention
isn't filled in on a form — it's **proposed** when the same kind of gap keeps recurring with the
same issuer, and at that point it's a normal decision again, with its own delta.

### The flags actually work · 2026-08-22

Until today they didn't. `.env.example` listed the `POLICY_*` flags under the heading
*"hot-swappable during the challenge,"* every policy below declared its own, and **none of them
were read anywhere**: `processMto` accepted `opts.policies` and no caller ever populated it, so
`DEFAULT_POLICIES` always won. Editing the `.env` and rerunning gave the same result, byte for
byte.

Now `policiesFromEnv()` (`src/rules/policies.ts`) resolves them **once per run**, inside
`processMto`, so no caller can forget — which is exactly what was happening. With two rules:

- **An invalid value blows up**, listing the accepted values. Falling back to the default would
  be a default silently firing while the operator believes something changed.
- **The run states what was changed.** Overrides show up in the header of `pnpm run run`, with a
  loud warning in `pnpm run eval` (*"these figures are NOT comparable to the published ones"*)
  and in the buyer's panel. A measurement taken with changed rules isn't the published
  measurement.

Verified against the real MTO:

```
$ pnpm run run                                    RESUELTA 15  REVISION 15
$ POLICY_MISSING_STANDARD=resolve pnpm run run    RESUELTA 16  REVISION 14
  políticas  NO por defecto -> missingStandard: review -> resolve
$ POLICY_MISSING_STANDARD=revisar pnpm run run
  ✖ POLICY_MISSING_STANDARD="revisar" no es un valor válido. Admitidos: review | resolve.
```

That extra line is `L019`, the only one in the gold set that goes to review **solely** because a
standard is missing.

---

## The twelve policies

P-7 is the only one without a flag: it isn't a choice between two behaviors but the
reconciliation of an internal contradiction in the client's document.

Email 001 carried **two** questions, not three, and the order here isn't the order they were sent
in: number 1 was the material (P-3), number 2 the finish (P-1). The third slot is still unspent.

| ID | Ambiguity | Asked? | Flag |
|---|---|---|---|
| P-1 | Scope of the finish within a set | ✅ email 001 #2 · **answered** | `POLICY_FINISH_SET_SCOPE` |
| P-2 | Unwritten multiplicity | ❌ our own call | `POLICY_IMPLICIT_MULTIPLICITY` |
| P-3 | Material not written in the MTO | ✅ email 001 #1 · answered in passing | `POLICY_MATERIAL_DERIVATION` |
| P-4 | Length without a unit | ❌ our own call | `POLICY_UNITLESS_LENGTH` |
| P-5 | Line with no standard | ❌ our own call | `POLICY_MISSING_STANDARD` |
| P-6 | Quality/type incoherence (8.8 nut) | ❌ already answered by the brief | `POLICY_QUALITY_COHERENCE` |
| P-7 | Internal contradiction in §5 (missing quality) | ❌ our own call | — |
| P-8 | HV hardness values outside a washer | ❌ our own call | `POLICY_HV_SCOPE` |
| P-9 | A row that isn't a fastener | ❌ our own call | `POLICY_OUT_OF_FAMILY` |
| P-10 | Bare number in a set's measure field | ❌ our own call | `POLICY_BARE_MEASURE_IN_SET` |
| P-11 | What to do with the value P-10 discards | ❌ our own call | `POLICY_REJECTED_MEASURE_AS_QUALITY` |
| P-12 | A finish the vocabulary doesn't recognize | ❌ our own call | `POLICY_UNKNOWN_FINISH` |

---

## P-1 · Scope of the finish within a set

**Problem.** The finish is written once at the row level (`...con tuerca DIN 934 y arandela
DIN 125, 8.8, zincado`) and the rules only cover extrapolating the measure. Because of the
no-mixed-finishes rule, the answer **changes which material gets purchased**.

**Why it's the trickiest of the three.** Both options are bad: extrapolating contradicts the
written rule; not extrapolating produces a physically inconsistent set (zinc-plated bolt + bare
nut), which is also a different material.

**Client's answer (2026-08-22):** *"Only the measure is extrapolated."*

**Current decision and default.** `POLICY_FINISH_SET_SCOPE=review`: a finish present but without
explicit attribution is **neither extrapolated nor turned into an absence**. Secondary elements go
to review with `FINISH_SCOPE_UNSTATED`. This differs from a row with no finish at all, where blank
is a valid value.

**Switchable alternatives to demonstrate sensitivity, not defaults.**
`=principal_only` attributes the finish only to the primary element; `=whole_set` extrapolates it
to the entire set and contradicts the answer received.

**Volume.** 4/15 rows (26%): rows 4, 6, 8, 9.

**Verifiable during the challenge.** Flip the flag live and show the KPI delta.

---

## P-2 · Unwritten multiplicity

**Problem.** `W/2 HEX. NUT` is explicit; `with NUT` and `con tuerca y arandela` are not. The rules
literally say "Quantities. There are no rules." And quantity **isn't one of the seven
attributes**, but without it the line can't be purchased: it's unclear whether it blocks
`RESUELTA` (RESOLVED).

**Decision (default).** Multiplicity **1** when not written, **2** for stud-bolt nuts (evidence
from rows 1 and 5), with `provenance: "inferred"`. **It doesn't block resolution**, but it's
flagged in the front end and is confirmable in bulk.

**Alternative.** `POLICY_IMPLICIT_MULTIPLICITY=review` → an unwritten quantity sends the line to
review with reason `QUANTITY_NOT_STATED`.

**Volume.** 3–4/15 rows: 2, 3, 8.

---

## P-3 · Material not written

**Problem.** The MTO almost never writes the material; the `MATERIAL` column contains the quality
grade or the standard. The rules say to extract what's present and give no derivation rule.

**Decision (default).** Derive `AC`/`INOX` from the quality grade (`A2*`/`A4*`/`304`/`316`/`18-8`
→ `INOX`; `8.8`/`10.9`/`12.9`/`GRADE *`/`8`/`10` → `AC`), with `provenance: "derived"` and a trace
to the value that justifies it. **It doesn't block resolution.** ASTM grades (`B7`, `2H`) → `AC`
via the standard.

**Alternative.** `POLICY_MATERIAL_DERIVATION=off` → missing material sends it to review. Expected
effect: autonomy falls to ~0%, which shows why the question mattered.

**Volume.** 14/15 rows. Only row 14 writes `acero` (steel).

---

## P-4 · Length without a unit

**Problem.** `7/8" X 130`: the 130 carries no unit.

**Our own call, in two cases that aren't the same.**

- **Metric** (`M20x90`, `M12 x 50`): no ambiguity. It's the ISO designation and the second number
  is millimeters. `provenance: "extracted"`, **certain** cell, not dependent on this policy.
- **Imperial** (`7/8" X 130`): here there is ambiguity. A plausibility-range table by measure
  applied in one pass, not row by row: 130 inches is 3.3 m, which doesn't exist for a 7/8" stud
  bolt → mm, with `provenance: "inferred"`. Anything outside the range **isn't resolved
  incorrectly**: it falls to review with `LENGTH_UNIT_IMPLAUSIBLE`.

**Volume.** Only 3 of the gold set's 30 lines (rows 1, 5, and 12). With
`POLICY_UNITLESS_LENGTH=review` autonomy drops from 50% to 40%.

**Why it wasn't asked.** There's a defensible and verifiable unilateral criterion (physical
range), and the pathological case falls to review instead of being resolved incorrectly.

---

## P-5 · Line with no standard

**Problem.** The only written review rule concerns quality. There's none for a missing standard.

**Our own call.** No standard → `REVISION_MANUAL` (MANUAL_REVIEW), reason `STANDARD_MISSING`.
Grounded in the client's own rules: §3 says the catalog doesn't distinguish subtypes and that
*"what tells them apart is the standard."* Without a standard there's no reference to request from
a supplier.

**Why it wasn't asked.** The client's rules already contain the argument. It also closes row 3 on
its own (`con tuerca y arandela`, with neither its own standard nor quality grade).

---

## P-6 · Quality/type incoherence

**Problem.** It's written that `8` and `10` only apply to nuts; not the reverse, and the MTO has
a nut with quality `8.8` (rows 11 and 13).

**Our own call.** `REVISION_MANUAL` (MANUAL_REVIEW), reason `QUALITY_TYPE_INCOHERENCE`.
**Never** normalize `8.8`→`8` on nuts: they're different equivalence groups (G5 vs G8), and
silently changing the spec is exactly the costly error.

**Why it wasn't asked.** The brief already gives the answer: `REVISION_MANUAL` is for "a
mandatory attribute is missing **or there's an inconsistency**." It's a planted case to see if it
gets caught.

---

## P-7 · Internal contradiction over missing quality

**Problem.** §5 says "if the Quality field is missing, the item is classified as manual review"
and two lines later "if it isn't entered, the element is allowed to be created without a
quality grade."

**Our own call.** These are two separate moments, not a contradiction: **the system** sends it to
review with reason `QUALITY_MISSING`; **the person** decides in the front end whether to create
the element without a quality grade. The front end implements that action explicitly ("create
without quality") and logs it.

---

## P-8 · HV hardness values outside a washer

**Problem.** Detected while building the coverage matrix (`09-coverage-and-blind-set.md`), not
listed in section 10. The five `HV` quality values (100/140/160/200/300) are hardness ratings,
practically speaking for washers. The rules explicitly restrict `8` and `10` to nuts, but **say
nothing about the HV values**. By the letter of the rules, a bolt with `200HV` is resolvable.

**Our own call.** It's resolved, not sent to review. Argument: the explicit `8`/`10` restriction
shows the rules can express a type-based restriction when they mean to; its absence for the HV
values is information, not an oversight. Inventing a restriction the client never wrote is exactly
what section 1 prohibits.

**Alternative.** `POLICY_HV_SCOPE=washer_only` → an HV value outside a washer flags
`QUALITY_TYPE_INCOHERENCE`.

**Volume.** 0/15 rows of the given MTO. 1 row of the synthetic set (C3).

---

## P-9 · A row that isn't a fastener

**Problem.** Detected while building the matrix. The rules assume everything coming in belongs to
the family. There's no rule for a flange, a gasket, or a pipe. **This is the worst failure mode in
the entire case**: seven plausible attributes invented for a row that isn't a fastener, coming out
as `RESUELTA` (RESOLVED) — literally "buying the wrong material with a machine's confidence."

**The brief says nothing, and that's been checked.** It's not that this is left open in §10: it's
that it isn't there at all. The PDF, §2 *Scope*, says *"A single family: fasteners. Seven
attributes"* and never mentions the matter again; in `reglas_tornilleria.md` the word "family"
only appears in the title. Neither ignoring it nor flagging it is prescribed. This one is ours.

**Our own call.** A third state for internal purposes, presented as `REVISION_MANUAL`
(MANUAL_REVIEW) with reason `OUT_OF_FAMILY` and `kind: OUT_OF_SCOPE`: it's not that the system
isn't sure, it's that the row isn't within its remit. In the front end it goes to **its own
queue**, *"No es tornillería"* ("Not a fastener"), and **outside the denominator**: it counts
neither as resolved nor as pending, because an MTO with more flanges isn't a worse system. The
five catalog names are **never** forced onto it.

**The second half of the decision, which cost more than the first.** Setting the row aside isn't
enough: it has to be set aside in the right queue. The first implementation gave it
`kind: MISSING_IN_SOURCE`, which is what routes it in `app/lib/derive.ts`, and with that the
flange landed in *"Vuelve a ingeniería"* ("Back to engineering"). That's wrong: this row is
missing no data at all, it's complete and well written. Engineering has nothing to fix and would
just send it back, and in the meantime it's noise in the one queue the brief explicitly says must
be kept clean (*"if the queue fills up with noise the buyer stops looking at it"*). Its real
destination is whoever buys the other families — which is, literally, what the brief calls the
easy part: *"if you know what material it is, you know which family it's in."* The system knows
it's **not** in its own family, and that's useful information, not garbage. Anchored in
`src/pipeline/__tests__/validate-out-of-family.test.ts`.

**Why it isn't silently ignored.** Two reasons, both from the brief itself. It has to be detected
regardless — the costly failure mode is a `RESUELTA` flange, not a visible one — so showing it
costs nothing extra. And with 20,000 rows the buyer has to reconcile Excel rows against output
lines: a row that vanishes without a trace can't be reconciled, and the session asks to *"show us
the rows that fell through."*

**Why it isn't asked (yet).** There's a defensible unilateral criterion, and it's the
conservative one. But it's the best candidate for the reserve question slot if a nuance comes up
during implementation that can't be closed on its own — for instance, if the client expects these
rows to be silently discarded instead of showing up in a queue.

**Alternative.** `POLICY_OUT_OF_FAMILY=silent_skip` → discarded and only counted in the report.
This is the one to flip if the client answers that they don't even want to see these rows.

**Volume.** 0/15 rows of the given MTO. 2 rows of the synthetic set (I1, I2), and **bet #12 for
the blind set.**

---

## P-10 · Bare number in a set's measure field

**Problem.** Detected while reviewing quantities on row 63 of the synthetic set:

```
63 | Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado
```

The extractor placed the nut's **quality** (`10`) and the number from the washer's **standard**
(the `125` in `DIN 125`) into the measure field for their respective elements.

**Why this deserves a policy and not a patch: it passed every existing defense.**

| Defense | Why it missed it |
|---|---|
| Span verification | Passes: the `10` and the `125` are literally in the row |
| Confidence | **0.95** on both lines — everything was read literally |
| `detectGaps` | Scans names, standards, finishes, and quality grades. **Not measures.** And the standard was in fact placed |
| Critic | Didn't even run on that row (see P-10bis below) |

And there's a second-order effect worse than the wrong value: since both secondary elements
"had" a measure, **§2's extrapolation never fired.** The correct measure —`M20`, inherited from
the bolt— never made it in.

**How close it came to being the costly error.** The washer was only in review because of
`FINISH_SCOPE_UNSTATED`, i.e. because of P-1 in `review` mode. With P-1 set to `principal_only`,
or if the row hadn't said "zincado" (zinc-plated), it would have come out **RESOLVED with measure
125**: a washer that doesn't exist, purchased with a machine's confidence. That's exactly the
3–8 week error.

**Our own call, and no model involved.** The client's rules close this on their own. §6: a
measure is either inches (`"`) or metric (`M`), and **there are no equivalences** between the two.
§2: the measure is the only thing that travels within a set. So, once one element in the row
carries a well-formed measure, a bare number on another element in the same row can't be a measure
of anything. It's discarded, and §2 supplies the correct one.

**Deliberately narrow.** It only acts with two or more elements, so the DIN 7981/7982 family
—where `4.8x25` really is the measure, rows 42 and 43— is untouched. And the anchor can be any
element, not just the primary one: if the extractor put the correct measure on the nut, the nut is
the anchor.

**Traceability.** The discarded value travels in the attribute's rule
(`rule:§2:measure_extrapolated (P-10 discarded "10")`), because otherwise it vanishes from the
system and nobody can audit the misreading. The challenge asks for per-attribute traceability.

**Alternative.** `POLICY_BARE_MEASURE_IN_SET=keep` → the previous behavior, with the false measure.

**Volume.** 0/15 rows of the given MTO. 1 row of the synthetic set (K2, row 63), 2 lines.

---

## P-11 · What to do with the value P-10 discards

**Problem.** Discarding the nut's `10` fixes the measure but leaves the line with
`QUALITY_MISSING`, and that's wrong: the row **does** write the quality grade. We'd be asking
engineering for a piece of data that's already written, which is noise in the one queue the brief
explicitly says must be kept clean.

**Our own call.** If the discarded value is in the quality catalog **and** is coherent with the
element's type, it's that element's quality grade. `10` on a `TUERCA` (NUT) is G9, and §5
restricts G8/G9 precisely to nuts: it fits. `125` isn't in any catalog, so the washer recovers
nothing.

**Why this isn't guessing.** `normalizeQuality` warns that deciding whether a loose number in free
text is a quality grade is the extractor's job, and it's right. Here we're not scanning free text:
we're reinterpreting a token the extractor **had already isolated and assigned to this element**,
and that we've just shown can't be a measure. The two guards — in the catalog and coherent with
the type — are what keep this from turning into a guess. Without the second one we'd manufacture
the very incoherence flagged in P-6.

**What it does NOT do.** It doesn't overwrite a quality grade an element already has, and it
doesn't recover anything for an element with no recognized name.

**Alternative.** `POLICY_REJECTED_MEASURE_AS_QUALITY=off` → the measure still gets corrected but
the line goes to review for `QUALITY_MISSING`. This is the conservative option, and its cost is a
90-second review per affected line.

**Volume.** 1 line (63.2). And it's a bet for the blind set: the `MATERIAL`-column trap
—*the column name is not the attribute*— has this sibling inside the description itself.

---

## P-12 · A finish the vocabulary doesn't recognize

**Problem.** Of the four attributes with a closed table, three had an output for an unknown value
and the finish did not: §9 declares the **absence** of a finish valid, and an alias the table
didn't recognize was marked `absent`. A new finish was indistinguishable from one the row simply
doesn't mention. The line came out RESOLVED and the no-finish reference got purchased — which §9
says is **a different part**.

**Decision (default).** `POLICY_UNKNOWN_FINISH=review` → reason `UNMAPPED_VALUE`, the line goes
to review and isn't exported as an RFQ. The `UNKNOWN_VALUE` gap still goes to the backlog (one
entry per alias). Closing the gap means registering the alias in `/vocabulario` (SPEC-011 /
SPEC-012), not resolving the line by hand one at a time.

**Alternative.** `=resolve` → previous behavior: the line resolves as if it had no finish; the gap
only stays in the backlog. This is the ablation of the published KPI. The 15-row gold set **has no
unknown finishes**, so the default doesn't move those figures. The delta shows up in the synthetic
MTO (`pnpm run mto:synthetic`).

**Why it wasn't asked.** §9 already gives the argument: with a finish and without one are
different parts. Silently resolving was the costly error. The flag stays to demonstrate the
delta.

**Volume.** 0/15 rows of the given MTO. In the synthetic suggestions MTO
(`pnpm run mto:synthetic`): 6 finish-only rows plus 1 combined (finish + material). The token
lives in the `ACABADO` column, not mixed into `DESCRIPCION`.

---

## P-10bis · The critic was silently crashing, on that very same row

This isn't a policy: it's a bug, and it's here because it was found pulling on the same thread,
and because it explains why P-10 got as far as it did.

`criticiseRow` requested `maxTokens: 2048`. The `critic` tier runs `gpt-oss-120b` with
`LLM_REASONING_EFFORT_CRITIC=high` —the dial that raised its accuracy from 33% to 100%
(`05-results.md`)— and on OpenRouter, thinking tokens are billed against `max_tokens`. Result:
**the harder the row, the more likely the safety net would run out of budget.** It got truncated,
the exception was swallowed by an empty `catch`, and the row came out with `ran: false`, which was
indistinguishable from "not eligible."

In the synthetic set: 3 of 4 eligible rows reviewed. The one missing was row 63.

**Fixed.** Budget raised to 8,192 tokens, and `CriticResult.failure` distinguishes the two cases.
Failures are counted, named in `pnpm run run` and `pnpm run eval`, and shown in the buyer's panel:
*"N rows didn't get the automated second read."* A safety net that silently stops working is worse
than not having one, because the panel's number doesn't move. Now: 4/4.

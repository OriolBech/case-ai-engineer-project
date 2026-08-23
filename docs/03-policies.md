# Policies · What the client's rules don't decide

The six ambiguities from section 10 of `reglas_tornilleria.md`, plus the ones we detected
ourselves. Each one has: decision, discarded alternative, flag that toggles it, and volume
affected on the 15-row MTO.

**Project invariant**: none of this is resolved implicitly in the code. If a behavior is not in
this table, it's a bug.

---

## What kind of object a policy is

This document had eleven well-argued policies and didn't say **what a policy is**, which turned
out to be the useful question on the day it had to be decided whether the material vocabulary
worked for everything.

There are **three distinct objects**, and confusing them is what leads to putting them in the same
table:

| | What it decides | Example |
|---|---|---|
| **Client catalog** | What their document says | The 5 names, the 25 DIN→ISO equivalences |
| **Vocabulary** | **Values**: this token means this value | `ZP → CINCADO`, `A4-70 → INOX` |
| **Policy** | **Behavior**: what I do when the rules stay silent | No standard → review (P-5) |

The catalog is theirs and isn't touched from here. The other two are ours, both carry
who/when/why, and yet **they must not share a place**, because they aren't approved the same way:

| | Vocabulary | Policy |
|---|---|---|
| Scope of impact | Local: only the rows that carry that token | Global: changes the state of an entire class of lines |
| What makes it approvable | The ambiguity guard: *does it break something it already resolves today?* | **The KPI delta**: *how many lines does it move, and in which direction?* |
| Who can sign off on it | An experienced buyer | Whoever answers for the cost of the error |
| Cadence | Continuous, dozens per month | Rare, and every change is an event |

The row that matters most is the second one. **What makes a policy approvable isn't the input,
it's the delta.** The vocabulary form asks *"AC or INOX?"*; a policy console has to answer
*"what happens to my numbers if I change this?"*. That's why it can't be the same screen.

### The scope, which today doesn't exist

The eleven policies are **global**. And the case statement says part of the engineering is
in-house and part is outsourced, and that *each writes the same nut a different way*. That points
to a fourth object this project doesn't have:

- **Convention** — how **this source** writes things. *"Firm A never writes the standard on
  threaded rods."* *"Firm B puts the quality grade in the MATERIAL column."* Many, per emitter, and
  it's what turns silent drift (`06-production-risks.md` §2) into something expected instead of
  a surprise.

The case that surfaced it: *"for VARILLA ROSCADA (threaded rod), absent a standard, the DIN
975/976 family is assumed."* It's not global —it doesn't hold for a bolt, where without a standard
you can't tell DIN 931 from DIN 933— nor is it specific to one emitter. It's a policy **scoped by
type**, and the moment you try to write it you see policies are missing that dimension.

**What's being deferred is acting, not observing.** Until today this paragraph lumped both things
together, which is why the price seemed prohibitive:

- **Observing** — stamping the emitter on every gap and every line sent to review. It's just one
  more field on top of the provenance that already exists, and **it doesn't break
  comparability**: it breaks the KPI down further, the global figure stays the aggregate. It's
  also what gives meaning to the gap rate, because without the emitter the learning curve averages
  populations the client says are distinct
  (`12-system-behind-the-rules.md` §4).
- **Acting** — policies scoped by emitter. That does multiply the configuration surface and
  **breaks KPI comparability**: you stop having one publishable number and end up with one per
  engineering firm. It's not built now, and it goes into `07-target-solution.md` §4 with that
  price written down.

The order matters: acting without having observed is configuring by hunch. A convention isn't
filled out in a form — it is **proposed** when the same shape of gap repeats for the same emitter,
and at that point it becomes a normal decision again, with its own delta.

### The flags work · 2026-08-22

Until today, they didn't. `.env.example` listed the `POLICY_*` flags under the heading *"toggleable
live during the challenge,"* each policy below declared its own, and **none of them was read
anywhere**: `processMto` accepted `opts.policies` and no caller ever populated it, so
`DEFAULT_POLICIES` always won. Touching the `.env` and rerunning gave the same result, byte for
byte.

Now `policiesFromEnv()` (`src/rules/policies.ts`) resolves them **once per run**, inside
`processMto`, so no caller can forget — which is exactly what was happening. With two rules:

- **An invalid value blows up**, with the list of accepted values. Falling back to the default
  would be a default silently firing, with the operator convinced something had changed.
- **The run reports what was changed.** Overrides appear in the header of `pnpm run run`, with a
  strong warning in `pnpm run eval` (*"these figures are NOT comparable with the published
  ones"*) and in the buyer panel. A measurement taken with the rules changed is not the published
  measurement.

Verified on the real MTO:

```
$ pnpm run run                                    RESUELTA 15  REVISION 15
$ POLICY_MISSING_STANDARD=resolve pnpm run run    RESUELTA 16  REVISION 14
  policies  NOT default -> missingStandard: review -> resolve
$ POLICY_MISSING_STANDARD=revisar pnpm run run
  ✖ POLICY_MISSING_STANDARD="revisar" is not a valid value. Accepted: review | resolve.
```

That extra line is `L019`, the only one in the gold set that goes to review **solely** for lack of
a standard.

---

## The eleven policies

P-7 is the only one without a flag: it's not a choice between two behaviors but the reconciliation
of an internal contradiction in the client's document.

Email 001 carried **two** questions, not three, and the order they're listed here isn't the order
they were asked: nº 1 was the material (P-3) and nº 2 the finish (P-1). The third slot remains
unspent.

| ID | Ambiguity | Asked? | Flag |
|---|---|---|---|
| P-1 | Scope of the finish within a set | ✅ email 001 nº 2 · **answered** | `POLICY_FINISH_SET_SCOPE` |
| P-2 | Unwritten multiplicity | ❌ own decision | `POLICY_IMPLICIT_MULTIPLICITY` |
| P-3 | Material not written in the MTO | ✅ email 001 nº 1 · answered in passing | `POLICY_MATERIAL_DERIVATION` |
| P-4 | Length without unit | ❌ own decision | `POLICY_UNITLESS_LENGTH` |
| P-5 | Line without standard | ❌ own decision | `POLICY_MISSING_STANDARD` |
| P-6 | Quality/type incoherence (8.8 nut) | ❌ already answered by the case statement | `POLICY_QUALITY_COHERENCE` |
| P-7 | §5 internal contradiction (missing quality) | ❌ own decision | — |
| P-8 | HV hardness values outside washers | ❌ own decision | `POLICY_HV_SCOPE` |
| P-9 | Row that isn't fastening hardware | ❌ own decision | `POLICY_OUT_OF_FAMILY` |
| P-10 | Bare number in a set's size field | ❌ own decision | `POLICY_BARE_MEASURE_IN_SET` |
| P-11 | What to do with the value P-10 discards | ❌ own decision | `POLICY_REJECTED_MEASURE_AS_QUALITY` |

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

**The case statement says nothing, and that has been checked.** It's not that it's left unresolved
in §10: it simply isn't there. The PDF, §2 *The scope*, says *"A single family: fasteners. Seven
attributes"* and never mentions the matter again; in `reglas_tornilleria.md` the word "family" only
appears in the title. Neither ignoring it nor flagging it is prescribed. It's one of ours.

**Own decision.** Third-party status for internal purposes, presented as `REVISION_MANUAL` with
reason `OUT_OF_FAMILY` and `kind: OUT_OF_SCOPE`: it's not that the system is unsure, it's that the
row isn't its responsibility. In the front end it goes to **its own queue**, *"Not fastening
hardware"*, and **outside the denominator**: it counts neither as resolved nor as pending, because
an MTO with more flanges isn't a worse system. **Never** forced into one of the five catalog
names.

**The second half of the decision, which cost more than the first.** Setting the row aside isn't
enough: it has to be set aside in the right queue. The first implementation gave it
`kind: MISSING_IN_SOURCE`, which is what routes in `app/lib/derive.ts`, and with that the flange
fell into "Back to engineering." That's false: that row is missing no data, it's complete and
well written. Engineering has nothing to fix and would return it, and meanwhile it's noise in the
one queue the case statement explicitly says must be kept clean (*"if the queue fills up with
noise the buyer stops looking at it"*). Its real destination is whoever buys the other families —
which is, literally, what the case statement calls the easy part: *"if you know what material it
is, you know which family it's in."* The system knows it's **not** in its own family, and that is
useful information, not garbage. Anchored in
`src/pipeline/__tests__/validate-out-of-family.test.ts`.

**Why it isn't silently ignored.** Two reasons, both from the case statement itself. It has to be
detected regardless —the costly failure mode is the `RESUELTA` flange, not the visible flange—
so showing it costs nothing extra. And with 20,000 rows the buyer has to reconcile Excel rows
against output lines: a row that disappears without a trace doesn't reconcile, and in the session
they ask *"show us the rows that got dropped."*

**Why it isn't asked (yet).** There is a defensible, conservative unilateral criterion. But it's
the best candidate for the reserved question slot if a nuance emerges during implementation that
can't be closed on its own — for example, if the client expects those rows to be silently ignored
rather than showing up in a queue.

**Alternative.** `POLICY_OUT_OF_FAMILY=silent_skip` → it is discarded and only counted in the
report. This is the one activated if the client answers that they don't even want to see those
rows.

**Volume.** 0/15 rows of the given MTO. 2 rows of the synthetic set (I1, I2), and **bet #12 for
the blind set**.

---

## P-10 · Bare number in a set's size field

**Problem.** Detected while reviewing the quantities in row 63 of the synthetic set:

```
63 | Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado
```

The extractor placed the nut's **quality grade** (`10`) and the number from the washer's
**standard** (the `125` in `DIN 125`) into the size field of their respective elements.

**Why it deserves a policy and not a patch: it passed every defense that existed.**

| Defense | Why it missed it |
|---|---|
| Span verification | Approves: the `10` and the `125` are literally in the row |
| Confidence | **0.95** on both lines — everything was read literally |
| `detectGaps` | Scans names, standards, finishes, and quality grades. **Not sizes.** And the standard was indeed placed correctly |
| Critic | Didn't even get to run on that row (see P-10bis below) |

And there's a second-order effect worse than the wrong value: since both secondary elements
"had" a size, **the extrapolation from §2 never fired**. The correct size —`M20`, inherited from
the bolt— never got set.

**How close it came to being the costly error.** The washer was only in review because of
`FINISH_SCOPE_UNSTATED`, i.e. because of P-1 in `review` mode. With P-1 in `principal_only`, or
if the row hadn't included "zincado," it would have come out **RESUELTA with size 125**: a washer
that doesn't exist, purchased with a machine's confidence. That is exactly the 3–8-week error.

**Own decision, and without a model.** The client's rules settle it on their own. §6: a size is
either inches (`"`) or metric (`M`), and **there are no equivalences** between the two. §2: the
size is the only thing that carries over within a set. So, as soon as one element of the row
carries a well-formed size, a bare number on another element of the same row can't be a size for
anything. It's discarded, and §2 supplies the correct one.

**Deliberately narrow.** It only acts with two or more elements, so the DIN 7981/7982 family —
where `4.8x25` really is the size, rows 42 and 43— is left untouched. And the anchor can be any
element, not just the principal one: if the extractor put the correct size on the nut, the nut is
the anchor.

**Traceability.** The discarded value travels in the attribute's rule
(`rule:§2:measure_extrapolated (P-10 discarded "10")`), because otherwise it disappears from the
system and nobody can audit the misreading. The challenge asks for the trace per attribute.

**Alternative.** `POLICY_BARE_MEASURE_IN_SET=keep` → the previous behavior, with the false size.

**Volume.** 0/15 rows of the given MTO. 1 row of the synthetic set (K2, row 63), 2 lines.

---

## P-11 · What to do with the value P-10 discards

**Problem.** Discarding the nut's `10` fixes the size but leaves the line with `QUALITY_MISSING`,
and that's false: the row **does** write the quality grade. We'd be asking engineering for a
value that's already written, which is noise in the one queue the case statement explicitly says
must be kept clean.

**Own decision.** If the discarded value is in the quality catalog **and** is coherent with the
element's type, it is that element's quality grade. `10` on a `TUERCA` is G9, and §5 restricts
G8/G9 precisely to nuts: it fits. `125` isn't in any catalog, so the washer recovers nothing.

**Why this isn't guessing.** `normalizeQuality` warns that deciding whether a loose number in free
text is a quality grade is the extractor's job, and it's right. Here we're not scanning free text:
we're reinterpreting a token the extractor **had already isolated and assigned to this element**,
and that we've just proven can't be a size. The two guards —in the catalog and coherent with the
type— are what keep this from becoming a guess. Without the second one we'd manufacture the exact
incoherence reported in P-6.

**What it does NOT do.** It doesn't overwrite a quality grade an element already has, and it
doesn't recover anything on an element without a recognized name.

**Alternative.** `POLICY_REJECTED_MEASURE_AS_QUALITY=off` → the size is still corrected and the
line goes to review for `QUALITY_MISSING`. It's the conservative option, and its cost is a 90 s
review per affected line.

**Volume.** 1 line (63.2). And it's a bet for the blind set: the `MATERIAL`-column trap —*the
column name isn't the attribute*— has this sibling inside the description.

---

## P-10bis · The critic was silently crashing, on that same row

This isn't a policy: it's a bug, and it's here because it was found pulling on the same thread,
and because it explains why P-10 got as far as it did.

`criticiseRow` requested `maxTokens: 2048`. The `critic` level runs `gpt-oss-120b` with
`LLM_REASONING_EFFORT_CRITIC=high` —the dial that raised its precision from 33% to 100%
(`05-results.md`)— and on OpenRouter thinking tokens are billed against `max_tokens`. Result:
**the harder the row, the more likely the safety net was to run out of budget.** It got truncated,
the exception was swallowed by an empty `catch`, and the row came out with `ran: false`, which was
indistinguishable from "wasn't eligible."

In the synthetic set: 3 of 4 eligible rows reviewed. The missing one was row 63.

**Fixed.** Budget raised to 8,192 tokens, and `CriticResult.failure` distinguishes the two cases.
Failures are counted, named in `pnpm run run` and `pnpm run eval`, and shown in the buyer panel:
*"N rows were left without the second automated read."* A safety net that silently stops working
is worse than not having one, because the panel's number doesn't move. Now: 4/4.

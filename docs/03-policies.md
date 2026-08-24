# Policies · What the client's rules don't decide

The six ambiguities from section 10 of `reglas_tornilleria.md`, plus the ones we detected
ourselves. Each one has: a decision, a discarded alternative, a flag that toggles it, and the
volume affected on the 15-row MTO.

**Project invariant**: none of this is resolved implicitly in the code. If a behavior isn't in
this table, it's a bug.

---

## What kind of object a policy is

This document had eleven well-argued policies and didn't say **what a policy is**, which turned
out to be the useful question the day we had to decide whether the material vocabulary covered
everything. Now there are **twelve**: P-12 (unrecognized finish) closes the silent hole in §9.

There are **three distinct objects**, and conflating them is what leads to lumping them into the
same table:

| | What it decides | Example |
|---|---|---|
| **Client catalog** | What their document says | The 5 names, the 25 DIN→ISO equivalences |
| **Vocabulary** | **Values**: this token means this value | `ZP → CINCADO`, `A4-70 → INOX` |
| **Policy** | **Behavior**: what to do when the rules are silent | No standard → review (P-5) |

The catalog belongs to them and isn't touched from here. The other two are ours, both carry
who/when/why, and even so **they must not share a table**, because they aren't approved the same
way:

| | Vocabulary | Policy |
|---|---|---|
| Scope of action | Local: only the rows carrying that token | Global: changes the state of an entire class of lines |
| What makes it approvable | The ambiguity guard: *does it break something it currently resolves?* | **The KPI delta**: *how many lines does it move, and in which direction?* |
| Who can sign off on it | A skilled buyer | Whoever answers for the cost of the error |
| Cadence | Continuous, dozens per month | Rare, and every change is an event |

The row that matters is the second one. **What makes a policy approvable isn't the input, it's
the delta.** The vocabulary form asks *"AC or INOX?"*; a policy console has to answer *"what
happens to my numbers if I change this?"*. That's why they can't be the same screen.

### Scope, which doesn't exist today

The twelve policies are **global**. And the brief states that part of the engineering is in-house
and part is outsourced, and that *each one writes the same nut a different way*. That points to a
fourth object this project doesn't have:

- **Convention** — how **this particular source** writes it. *"El estudio A nunca escribe la norma
  en las varillas."* *"El estudio B mete la calidad en la columna MATERIAL."* By issuer, many of
  them, and this is what turns the silent drift (`06-production-risks.md` §2) into something
  expected rather than a surprise.

The case that exposed this: *"para VARILLA ROSCADA, a falta de norma se asume la familia DIN
975/976"*. It isn't global —it doesn't hold for a bolt, where without a standard you can't tell
DIN 931 from DIN 933— nor is it tied to a specific issuer. It's a policy **with type-level scope**,
and as soon as you try to write it down you see that policies are missing that dimension.

**What's being deferred is acting, not observing.** Until today this paragraph lumped both things
together, which is why the price seemed prohibitive:

- **Observing** — stamping the issuer on every gap and every line sent to review. It's one more
  field on top of the provenance that already exists, and **it doesn't break comparability**: it
  breaks the KPI down further, the global figure remains the aggregate. It's also what makes the
  gap rate mean something, because without the issuer the learning curve averages populations that
  the client says are distinct (`12-system-behind-the-rules.md` §4).
- **Acting** — policies scoped by issuer. That does multiply the configuration surface and
  **breaks KPI comparability**: instead of one publishable number you end up with one per studio.
  It isn't being built now, and it goes into `07-target-solution.md` §4 with that price spelled
  out.

Order matters: acting before observing is configuring by gut feeling. A convention isn't filled in
on a form — it's **proposed** when the same shape of gap repeats for the same issuer, and at that
point it becomes a normal decision again, with its own delta.

### The flags work · 2026-08-22

Until today, they didn't. `.env.example` listed the `POLICY_*` flags under the label
*"conmutables en caliente durante el challenge"*, each policy below declared its own, and **none
of them was read anywhere**: `processMto` accepted `opts.policies` and no caller ever populated
it, so `DEFAULT_POLICIES` always won. Touching the `.env` file and re-running produced the exact
same result, byte for byte.

Now `policiesFromEnv()` (`src/rules/policies.ts`) resolves them **once per run**, inside
`processMto`, so that no caller can forget — which is exactly what was happening. With two rules:

- **An invalid value blows up**, listing the accepted values. Falling back to the default would be
  a default firing silently, while the operator remains convinced something changed.
- **The run reports what was changed.** Overrides show up in the header of `pnpm run run`, with a
  strong warning in `pnpm run eval` (*"estas cifras NO son comparables con las publicadas"*) and in
  the buyer's panel. A measurement taken with changed rules is not the published measurement.

Verified against the real MTO:

```
$ pnpm run run                                    RESUELTA 15  REVISION 15
$ POLICY_MISSING_STANDARD=resolve pnpm run run    RESUELTA 16  REVISION 14
  políticas  NO por defecto -> missingStandard: review -> resolve
$ POLICY_MISSING_STANDARD=revisar pnpm run run
  ✖ POLICY_MISSING_STANDARD="revisar" no es un valor válido. Admitidos: review | resolve.
```

That one extra line is `L019`, the only one in the gold set that goes to review **solely** for
lack of a standard.

---

## The twelve policies

P-7 is the only one without a flag: it isn't a choice between two behaviors but the reconciliation
of an internal contradiction in the client's document.

Email 001 carried **two** questions, not three, and the order they appear in there doesn't match
this table: question no. 1 was material (P-3) and no. 2 was finish (P-1). The third slot is still
unused.

| ID | Ambiguity | Asked? | Flag |
|---|---|---|---|
| P-1 | Scope of the finish within a set | ✅ email 001 no. 2 · **answered** | `POLICY_FINISH_SET_SCOPE` |
| P-2 | Unwritten multiplicity | ❌ our own decision | `POLICY_IMPLICIT_MULTIPLICITY` |
| P-3 | Material not written in the MTO | ✅ email 001 no. 1 · answered in passing | `POLICY_MATERIAL_DERIVATION` |
| P-4 | Length without a unit | ❌ our own decision | `POLICY_UNITLESS_LENGTH` |
| P-5 | Line without a standard | ❌ our own decision | `POLICY_MISSING_STANDARD` |
| P-6 | Quality/type incoherence (8.8 nut) | ❌ already answered by the brief | `POLICY_QUALITY_COHERENCE` |
| P-7 | Internal contradiction in §5 (missing quality) | ❌ our own decision | — |
| P-8 | HV hardness values outside washers | ❌ our own decision | `POLICY_HV_SCOPE` |
| P-9 | Row that isn't fasteners | ❌ our own decision | `POLICY_OUT_OF_FAMILY` |
| P-10 | Bare number in a set's measure field | ❌ our own decision | `POLICY_BARE_MEASURE_IN_SET` |
| P-11 | What to do with the value P-10 discards | ❌ our own decision | `POLICY_REJECTED_MEASURE_AS_QUALITY` |
| P-12 | Finish the vocabulary doesn't recognize | ❌ our own decision | `POLICY_UNKNOWN_FINISH` |

---

## P-1 · Scope of the finish within a set

**Problem.** The finish is written once at the row level (`...con tuerca DIN 934 y arandela
DIN 125, 8.8, zincado`) and the rules only account for extrapolating the measure. Under the
no-mixed-finishes rule, the answer **changes which material gets purchased**.

**Why it's the most delicate of the three.** Both options are bad: extrapolating contradicts the
written rule; not extrapolating produces a physically inconsistent set (galvanized bolt + bare
nut) that is also a different material.

**Decision (default, pending the client's answer).** The finish written at the row level extends
to **every element in the set**, with `provenance: "extrapolated"`. Rationale: the finish is a
specification of the functional assembly, and a mixed set isn't purchasable.

**Alternative.** `POLICY_FINISH_SET_SCOPE=principal_only` → only the main element; the rest come
out without a finish. `=review` → the rest go to review.

**Volume.** 4/15 rows (26%): rows 4, 6, 8, 9.

**Verifiable in the challenge.** Change the flag live and show the KPI delta.

---

## P-2 · Unwritten multiplicity

**Problem.** `W/2 HEX. NUT` is explicit; `with NUT` and `con tuerca y arandela` are not. The rules
literally say, *"Cantidades. No hay reglas."* And quantity **is not one of the seven attributes**,
but without it the line can't be purchased: it isn't clear whether that blocks `RESUELTA`.

**Decision (default).** Multiplicity **1** when not written, **2** for stud nuts (evidence from
rows 1 and 5), with `provenance: "inferred"`. **It doesn't block resolution**, but it's flagged in
the front end and can be confirmed in bulk.

**Alternative.** `POLICY_IMPLICIT_MULTIPLICITY=review` → an unwritten quantity sends the line to
review with reason `QUANTITY_NOT_STATED`.

**Volume.** 3–4/15 rows: 2, 3, 8.

---

## P-3 · Material not written

**Problem.** The MTO almost never writes the material explicitly; the `MATERIAL` column contains
quality or standard instead. The rules say to extract what appears and give no derivation rule.

**Decision (default).** Derive `AC`/`INOX` from the quality (`A2*`/`A4*`/`304`/`316`/`18-8` →
`INOX`; `8.8`/`10.9`/`12.9`/`GRADE *`/`8`/`10` → `AC`), with `provenance: "derived"` and a trace to
the value that justifies it. **It doesn't block resolution.** ASTM grades (`B7`, `2H`) → `AC`
based on the standard.

**Alternative.** `POLICY_MATERIAL_DERIVATION=off` → missing material sends the line to review.
Expected effect: autonomy drops to ~0%, which demonstrates why the question mattered.

**Volume.** 14/15 rows. Only row 14 writes `acero`.

---

## P-4 · Length without a unit

**Problem.** `7/8" X 130`: the 130 has no unit.

**Our own decision, in two cases that aren't the same.**

- **Metric** (`M20x90`, `M12 x 50`): there's no ambiguity. It's the ISO designation and the second
  number is in millimeters. `provenance: "extracted"`, a **certain** cell, not dependent on this
  policy.
- **Imperial** (`7/8" X 130`): here it does. A table of plausibility ranges per measure, applied
  all at once, not row by row: 130 inches is 3.3 m, which doesn't exist for a 7/8" stud → mm, with
  `provenance: "inferred"`. Whatever falls outside the range **isn't resolved incorrectly**: it
  drops to review with `LENGTH_UNIT_IMPLAUSIBLE`.

**Volume.** Only 3 of the 30 lines in the gold set (rows 1, 5, and 12). With
`POLICY_UNITLESS_LENGTH=review` autonomy drops from 50% to 40%.

**Why it wasn't asked.** There's a defensible, verifiable unilateral criterion (physical range),
and the pathological case falls to review instead of being resolved incorrectly.

---

## P-5 · Line without a standard

**Problem.** The only written review rule is the one about quality. There is none for a missing
standard.

**Our own decision.** No standard → `REVISION_MANUAL`, reason `STANDARD_MISSING`. Grounded in the
rules themselves: §3 says the catalog doesn't distinguish subtypes and that *"lo que los
diferencia es la norma"*. Without a standard there's no reference to request from a supplier.

**Why it wasn't asked.** The client's rules contain the argument. It also resolves row 3 on its
own (`con tuerca y arandela`, with no standard or quality of its own).

---

## P-6 · Quality/type incoherence

**Problem.** It's written that `8` and `10` only apply to nuts; not the other way around, and the
MTO includes a nut with quality `8.8` (rows 11 and 13).

**Our own decision.** `REVISION_MANUAL`, reason `QUALITY_TYPE_INCOHERENCE`. **Never** normalize
`8.8`→`8` on nuts: they are distinct equivalence groups (G5 vs G8) and silently changing the
specification is exactly the costly error.

**Why it wasn't asked.** The brief already gives the answer: `REVISION_MANUAL` applies when "falta
un atributo obligatorio **o hay una incoherencia**." It's a planted case to see whether it gets
detected.

---

## P-7 · Internal contradiction about missing quality

**Problem.** §5 says "si falta el campo Calidad, el item se clasifica como revisión manual" and
two lines later "si no se introduce, se permite crear el elemento sin calidad".

**Our own decision.** They are two different moments, not a contradiction: **the system** sends it
to review with reason `QUALITY_MISSING`; **the person** decides in the front end whether to create
the element without a quality. The front end implements that action explicitly ("crear sin
calidad") and logs it.

---

## P-8 · HV hardness values outside washers

**Problem.** Found while building the coverage matrix (`09-coverage-and-blind-set.md`), not listed
in section 10. The five `HV` qualities (100/140/160/200/300) are hardness values, in practice used
for washers. The rules explicitly restrict `8` and `10` to nuts, but **say nothing about the
HVs**. By the letter of the rules, a bolt with `200HV` is resolvable.

**Our own decision.** It resolves, it isn't sent to review. Argument: the explicit `8`/`10`
restriction shows the rules know how to express a type-based restriction when they want to; its
absence for the HVs is information, not an oversight. Inventing a restriction the client never
wrote is exactly what section 1 forbids.

**Alternative.** `POLICY_HV_SCOPE=washer_only` → an HV value outside a washer flags
`QUALITY_TYPE_INCOHERENCE`.

**Volume.** 0/15 rows in the given MTO. 1 row in the synthetic set (C3).

---

## P-9 · Row that isn't fasteners

**Problem.** Found while building the matrix. The rules assume that everything that comes in
belongs to the family. There's no rule for a flange, a gasket, or a pipe. **This is the worst
failure mode in the entire case**: seven plausible attributes invented for a row that isn't a
bolt, coming out as `RESUELTA` — literally "buying the wrong material with a machine's
confidence".

**The brief says nothing about this, and that has been verified.** It isn't that it's left open in
§10: it's that it isn't there at all. The PDF, §2 *El alcance*, says *"Una sola familia:
tornillería. Siete atributos"* and never mentions the matter again; in `reglas_tornilleria.md` the
word "familia" only appears in the title. Neither ignoring it nor flagging it is prescribed. This
one is ours.

**Our own decision.** A third internal state, presented as `REVISION_MANUAL` with reason
`OUT_OF_FAMILY` and `kind: OUT_OF_SCOPE`: it isn't that the system is unsure, it's that the row
isn't within its remit. In the front end it goes to **its own queue**, *"No es tornillería"*, and
**outside the denominator**: it counts neither as resolved nor as pending, because an MTO with more
flanges isn't a worse system. It is **never** forced into one of the catalog's five names.

**The second half of the decision, which cost more than the first.** Setting the row aside isn't
enough: it has to be set aside into the right queue. The first implementation gave it
`kind: MISSING_IN_SOURCE`, which is what routes things in `app/lib/derive.ts`, and with that the
flange landed in *"Vuelve a ingeniería"*. That's wrong: that row is missing no data at all, it's
complete and well written. Engineering has nothing to fix and would just bounce it back, and in
the meantime it's noise in the one queue the brief explicitly says must be kept clean (*"si la
cola se llena de ruido el comprador deja de mirarla"*). Its real destination is whoever buys the
other families — which is, literally, what the brief calls the easy part: *"si sabes qué material
es, sabes en qué familia está"*. The system knows it's **not** in its own family, and that's useful
information, not noise. Anchored in `src/pipeline/__tests__/validate-out-of-family.test.ts`.

**Why it isn't silently ignored.** Two reasons, both from the brief itself. It still has to be
detected either way —the costly failure mode is the `RESUELTA` flange, not the visible one—, so
showing it costs nothing extra. And with 20,000 rows the buyer has to reconcile Excel rows against
output lines: a row that vanishes without a trace can't be reconciled, and in the session they
ask, *"enséñanos las filas que se te han caído"*.

**Why it isn't asked (yet).** There's a defensible unilateral criterion, and it's the conservative
one. But it's the best candidate for the reserved question slot if a nuance turns up during
implementation that can't be closed on our own — for example, if the client expects those rows to
be silently ignored instead of appearing in a queue.

**Alternative.** `POLICY_OUT_OF_FAMILY=silent_skip` → it's discarded and only counted in the
report. This is the one to activate if the client answers that they don't even want to see those
rows.

**Volume.** 0/15 rows in the given MTO. 2 rows in the synthetic set (I1, I2), and **bet no. 12 for
the blind set**.

---

## P-10 · Bare number in a set's measure field

**Problem.** Found while reviewing the quantities in row 63 of the synthetic set:

```
63 | Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado
```

The extractor placed the nut's **quality** (`10`) and the washer's **standard** number (the `125`
in `DIN 125`) in the measure field of their respective elements.

**Why this deserves a policy and not a patch: it got past every defense that existed.**

| Defense | Why it didn't catch it |
|---|---|
| Span verification | Passes: the `10` and the `125` are literally in the row |
| Confidence | **0.95** on both lines — everything was read literally |
| `detectGaps` | Walks names, standards, finishes, and qualities. **Not measures.** And the standard was in fact populated |
| Critic | Didn't even get to run on that row (see P-10bis below) |

And there's a second-order effect worse than the wrong value: since both secondary elements "had"
a measure, **the §2 extrapolation never fired**. The correct measure —`M20`, inherited from the
bolt— never got applied.

**How close this came to being the costly error.** The washer was only under review because of
`FINISH_SCOPE_UNSTATED`, i.e. because of P-1 in `review` mode. With P-1 set to `principal_only`,
or if the row hadn't included "zincado", it would have come out **RESUELTA with measure 125**: a
washer that doesn't exist, purchased with a machine's confidence. It's exactly the 3–8 week error.

**Our own decision, and without a model.** The client's rules settle it on their own. §6: a measure
is either inches (`"`) or metric (`M`), and **there are no equivalences** between the two. §2: the
measure is the only thing that travels within a set. So, as soon as one element in the row carries
a well-formed measure, a bare number on another element in the same row cannot be a measure of
anything. It's discarded, and §2 supplies the correct one.

**Deliberately narrow.** It only acts with two or more elements, so the DIN 7981/7982 family
—where `4.8x25` really is the measure, rows 42 and 43— is left untouched. And the anchor can be
any element, not just the main one: if the extractor put the correct measure on the nut, the nut
is the anchor.

**Traceability.** The discarded value travels within the attribute's rule
(`rule:§2:measure_extrapolated (P-10 descartó "10")`), because otherwise it vanishes from the
system and nobody can audit the mistaken reading. The challenge asks for per-attribute
traceability.

**Alternative.** `POLICY_BARE_MEASURE_IN_SET=keep` → the previous behavior, with the false measure.

**Volume.** 0/15 rows in the given MTO. 1 row in the synthetic set (K2, row 63), 2 lines.

---

## P-11 · What to do with the value P-10 discards

**Problem.** Discarding the nut's `10` fixes the measure but leaves the line with
`QUALITY_MISSING`, and that's false: the row **does** write the quality. We'd be asking
engineering for data that's already written, which is noise in the one queue the brief explicitly
says must be kept clean.

**Our own decision.** If the discarded value is in the quality catalog **and** is coherent with
the element's type, it's that element's quality. `10` on a `TUERCA` is G9, and §5 restricts G8/G9
precisely to nuts: it fits. `125` isn't in any catalog, so the washer recovers nothing.

**Why this isn't guessing.** `normalizeQuality` warns that deciding whether a loose number in free
text is a quality is the extractor's job, and it's right. Here we aren't scanning free text: we're
reinterpreting a token the extractor **had already isolated and assigned to this element**, and
one we just proved can't be a measure. The two guards —being in the catalog and being coherent
with the type— are what keep this from turning into a guess. Without the second one we'd
manufacture the very incoherence we report in P-6.

**What it does NOT do.** It doesn't overwrite a quality the element already has, and it doesn't
recover anything on an element without a recognized name.

**Alternative.** `POLICY_REJECTED_MEASURE_AS_QUALITY=off` → the measure gets corrected either way
and the line goes to review for `QUALITY_MISSING`. It's the conservative option, and its cost is a
90-second review per affected line.

**Volume.** 1 line (63.2). And it's a bet for the blind set: the `MATERIAL`-column trap —*the
column name isn't the attribute*— has this sibling hidden inside the description.

---

## P-12 · Finish the vocabulary doesn't recognize

**Problem.** Of the four attributes with a closed table, three had an output path for an unknown
value and the finish did not: §9 states that an **absent** finish is valid, and an alias the table
didn't recognize was marked `absent`. A new finish was indistinguishable from one the row simply
doesn't mention. The line came out RESUELTA and the reference without a finish got purchased —
which §9 says is **a different part**.

**Decision (default).** `POLICY_UNKNOWN_FINISH=review` → reason `UNMAPPED_VALUE`, the line goes to
**En revisión** and isn't exported as an RFQ. The `UNKNOWN_VALUE` gap still goes to the backlog (a
single entry per alias). Closing the gap means registering the alias in `/vocabulario`
(SPEC-011 / SPEC-012), not resolving the line by hand one at a time.

**Alternative.** `=resolve` → previous behavior: the line resolves as if it carried no finish; the
gap remains only in the backlog. This is the ablation of the published KPI. The 15-row gold set
**contains no unknown finishes**, so the default doesn't move those figures. The delta shows up in
the synthetic MTO (`pnpm run mto:synthetic`).

**Why it wasn't asked.** §9 already provides the argument: with a finish and without a finish are
different references. Resolving silently was the costly error. The flag remains to demonstrate
the delta.

**Volume.** 0/15 rows in the given MTO. In the synthetic suggestions MTO
(`pnpm run mto:synthetic`): 6 finish-only rows plus 1 combined one (finish + material). The token
lives in the `ACABADO` column, not mixed into `DESCRIPCION`.

---

## P-10bis · The critic was silently crashing, on that very row

This isn't a policy: it's a bug, and it's here because it was found by pulling the same thread,
and because it explains why P-10 got as far as it did.

`criticiseRow` requested `maxTokens: 2048`. The `critic` tier runs `gpt-oss-120b` with
`LLM_REASONING_EFFORT_CRITIC=high` —the dial that raised its accuracy from 33% to 100%
(`05-results.md`)— and on OpenRouter thinking tokens are billed against `max_tokens`. Result:
**the harder the row, the more likely the safety net was to run out of budget**. It got truncated,
the exception was swallowed by an empty `catch`, and the row came out with `ran: false`, which was
indistinguishable from "wasn't eligible".

In the synthetic set: 3 of 4 eligible rows were reviewed. The one missing was row 63.

**Fixed.** Budget raised to 8,192 tokens, and `CriticResult.failure` distinguishes the two cases.
Failures are counted, called out in `pnpm run run` and `pnpm run eval`, and shown in the buyer's
panel: *"N filas se han quedado sin la segunda lectura automática"*. A safety net that stops
working without any warning is worse than not having one, because the panel's number doesn't move.
Now: 4/4.

# Results

> Status: ✅. Feeds section 3 of the 2-pager. Measured with `pnpm run eval`.
> **Reference model: `openai/gpt-oss-120b` via OpenRouter** — this is the one being delivered, and the
> one that costs 176× less on output than `gpt-5.5` while matching its result. No OpenAI credit since
> 2026-08-22, so the `gpt-5.5` figures that remain in this document are from before and are marked as such.

## Against the gold set (15 rows → 30 lines)

**Eight cells per line**: the seven attributes plus the quantity. **211 certain out of 240**; the remaining
29 depend on a declared policy and are reported separately.

`openai/gpt-oss-120b`, critic off (this measures the extractor):

| Metric | Value |
|---|---|
| **Silent error** (primary) | **0.0%** — 0 errors among 15 resolved lines · **count 0** |
| **Useful autonomy** | **50.0%** — 15 of 30 |
| **Split fidelity** | **100%** — 15 of 15 rows |
| **Queue noise** | **0.0%** — 0 of 15 reviews |
| Status agreement | 100% |
| Exact reasons | 100% |
| Span hallucinations | 0 |
| Rejected multiplicities | 0 |

Breakdown by attribute: **211 of 211 certain cells**, and the 29 policy cells also correct.

| Attribute | Certain | Policy |
|---|---|---|
| name | 30/30 | — |
| material | 13/13 | 17/17 |
| quality | 30/30 | — |
| measure | 30/30 | — |
| length | 27/27 | 3/3 |
| standard | 30/30 | — |
| finish | 30/30 | — |
| **quantity** | **21/21** | **9/9** |

### Quantity is the eighth cell, and it wasn't being looked at

This needs to be said here and not in a footnote, because it changes how everything above should be read.
`gold.jsonl` has labeled quantity per line since day one, with its own certain/policy split, and the
harness **only compared seven cells**: the loop iterated over the catalog attribute list, and quantity
is not in it.

Consequence: a line requesting **10,000 bolts where the MTO asks for 100** came out with a
perfect breakdown. This was the actual state of two `gpt-5.4-mini` lines, and it was caught by **the
critic**, whose two "false positives" on rows 4 and 7 were in fact correct and were held against it by a
judge that wasn't looking at the field they were talking about.

Quantity isn't part of the seven-attribute breakdown — it's not a catalog attribute — but it **does
count** toward the silent error rate: it's the only field where an error *multiplies* the order. Full
detail, with the three fixes that were needed, in `10-benchmarks.md` §3-bis.

**Any figure in this project prior to the afternoon of 2026-08-22 is blind to that cell**, and the
ones kept here are marked accordingly.

**The mandatory caveat about this 100%.** These are 30 lines, and I wrote both the gold **and** the
prompt. A blind spot shared between the two isn't caught by this measurement — and the quantity cell
is proof that this risk is real, because it went eighteen hours unmeasured. What supports the number
against that are the 64 targeted synthetic rows — written from coverage gaps, not from the MTO — and
the blind set from the session day, which is the real proof.

## Open model sweep (OpenRouter)

`pnpm run sweep` · 8 models × 15 rows · critic off (this measures the extractor) ·
**total sweep cost: €0.055**

> **This table predates the name fix** (`findNames` decides, not the model). `gpt-oss-120b`
> shows up at 13% silent error; **after the fix it's at 0%**, same as `gpt-5.5`. The final
> state — and the sweep that does include that fix — is in `10-benchmarks.md` §2. The error and
> autonomy columns are over **seven** cells (210), not 211: quantity wasn't compared yet.

| Model | $/M output | Silent error | Autonomy | **Split** | Noise | €/row |
|---|---|---|---|---|---|---|
| `gpt-5.5` (reference) | 30.00 | **0%** | **50.0%** | **100%** | 0% | 0.0239 |
| **`moonshotai/kimi-k3`** | 15.00 | **0%** | **50.0%** | **100%** | **0%** | **0.0169** |
| **`openai/gpt-oss-120b`** | **0.17** | 13% (2) | **43.3%** | **100%** | 0% | 0.000095 |
| `qwen/qwen3-235b-a22b-2507` | 0.55 | 21% (3) | 36.7% | **100%** | 6% | 0.00005 |
| `deepseek/deepseek-v3.2` | 0.40 | 0% | 40.0% | 93% | 13% | 0.00031 |
| `deepseek/deepseek-v4-pro-0813` | 3.56 | 0% | 23.3% | 60% | 14% | 0.0014 |
| `z-ai/glm-5.2` | 3.04 | 33% (2) | 13.3% | 53% | 17% | 0.0019 |
| `qwen/qwen3.8-max` | 6.00 | 0% | **0.0%** | 40% | 67% | — |

### 0. `kimi-k3` matches `gpt-5.5` exactly

**210 of 210 correct cells in this sweep** (seven attributes; the eighth cell not yet compared), 0%
silent error, 100% split, 0% noise. The only open model that reproduces the reference without a
single difference, and at half the output rate (15.00 vs. 30.00 $/M) and 29% lower cost measured per
row.

What this buys isn't cost — the rate difference is noise next to the €87,500 baseline — but
**removing vendor lock-in from the quality equation**. The commitment to the client stops
depending on a specific vendor, and that's an argument that holds up to a procurement director's
question.

Sample-size caveat: "perfect" over 30 lines doesn't distinguish `kimi-k3` from `gpt-5.5`. What
the sample does support is elimination: the five models that break sets are out without discussion.

### 1. Price doesn't predict quality

Ordered by output price, quality does **not** follow:

| $/M output | 30.00 | **15.00** | 6.00 | 3.56 | 3.04 | 0.55 | 0.40 | **0.17** |
|---|---|---|---|---|---|---|---|---|
| Split fidelity | 100% | **100%** | 40% | 60% | 53% | 100% | 93% | **100%** |

**The cheapest open model on the list is the best open model on the list**, and it beats models
that cost 35× more on output. `qwen3.8-max` at $6/M is the worst of the seven. Choosing a model by
rate would have been choosing wrong.

### 2. `qwen3.8-max` is the degenerate case the brief warns about

0% silent error **because it resolves nothing**: 0% autonomy, 67% queue noise. It's literally
*"a system that gets 100% right by sending 90% of rows to review is useless."*

And it's proof that the KPI works: ordered by silent error alone, this model comes out
**first**. All four metrics together are needed to put it last, which is where it belongs.

### 3. Split fidelity is what separates them

Only three models hold 100%: `gpt-5.5`, `gpt-oss-120b`, and `qwen3-235b`. The rest break between
7% and 60% of sets. And breaking a set isn't a wrong attribute: it's **material nobody buys**. That's
the reason to report it separately rather than averaged, and it confirms that set explosion is
"the rule that costs the most" for the models too.

### 4. An artifact of my own harness, and it must be disclosed

**The 0% silent error of `deepseek-v3.2`, `v4-pro`, and `qwen3.8-max` is not comparable to that of
`gpt-5.5`.** When the split fails, the lines don't line up with the gold and the harness can't
compare them, so fewer lines enter the denominator. A model that doesn't know how to separate sets
gets a favorably skewed silent-error rate.

Rule derived from this: **silent error can only be read together with split fidelity.** Below
100% split, the silent error figure is not reliable. Added as a caveat in `02-kpi.md`.

### 5. The only thing `gpt-oss-120b` gets wrong is the attribute the tables already get right

Its breakdown: `name` **93%**, and the other six at **100%**.

| Model | name | material | quality | measure | length | standard | finish |
|---|---|---|---|---|---|---|---|
| `gpt-5.5` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `kimi-k3` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `gpt-oss-120b` | **93%** | 100% | 100% | 100% | 100% | 100% | 100% |
| `qwen3-235b` | 87% | 92% | 97% | 100% | 100% | 100% | 100% |
| `deepseek-v3.2` | 96% | 100% | 96% | 96% | 96% | 96% | 95% |
| `deepseek-v4-pro` | 79% | 80% | 86% | 79% | 75% | 79% | 75% |
| `glm-5.2` | 83% | 100% | 67% | 83% | 90% | 83% | 90% |

Its 2 failures are **name** failures — and name is precisely the attribute `src/rules/names.ts` gets
right 100% of the time without a model. Right now `normalize.ts` keeps the model's name. Preferring
the table's name when deterministic detection is unambiguous should take `gpt-oss-120b` from 13% to
~0% silent error **for free**, without changing models.

That's the next iteration, and it's the kind of improvement that only shows up when looking at the
per-attribute breakdown instead of the aggregate.

### 6. The three configurations left on the table

| | Quality | €/row | € per project (500,000 reads) | Argument |
|---|---|---|---|---|
| `gpt-5.5` | perfect | 0.0175 | **8,750** | The reference. Latency with 9× variance |
| `kimi-k3` | perfect on the gold, **1 of 4** on the synthetic | 0.0169 | ~8,450 | Same quality, no vendor lock-in |
| **`gpt-oss-120b`** | **perfect** · 211/211 certain cells | **0.000095** | **48** | **The choice.** 176× cheaper on output |

**Decided: `gpt-oss-120b`.** The condition that had been left written here — "if the preference for
the table on the name attribute takes it to 0%" — was met: the 13% silent error it had was **two
cells** (`STUD BOLT` classified as `VARILLA ROSCADA`), the model returned the correct literal term
and only erred on classification, and the table decides the name. It's now at 0% across all eight
cells.

The other two remain as calibration: `gpt-5.5` because the prompt was tuned on it, and `kimi-k3`
because it's a useful counterexample — identical on the gold, and three rows worse on the synthetic.

### 7. The cost denominator was wrong, and it's a 5× · 2026-08-22

The brief says *"better to do the multiplication before the CFO does."* Doing it properly reveals
that the number we were multiplying wasn't the right one.

The figures above extrapolate **4,000 rows × 25 reads**, which are the rows **of bolted fasteners**
(20,000 × 20%). But the system doesn't charge per bolted-fastener row: it charges per **row it
reads**. And to know which of the 20,000 are bolted fasteners, they all have to be read. Today the
only shortcut before the model is `isEmptyDescription` — rows with no text — so a flange or a gasket
**pays its call** and comes back with `outOfFamily: true`.

Real denominator: **20,000 × 25 = 500,000 calls per project, not 100,000.**

| | €/row | Rows charged per project | € per project |
|---|---|---|---|
| As written | 0.000095 | 100,000 | €9 |
| **Honest, no pre-filter** | 0.000095 | **500,000** | **€48** |
| `gpt-5.5`, honest | 0.0175 | 500,000 | **€8,750** (was €1,749) |

With the chosen model the error is irrelevant in euros — €48 against the €87,500 baseline is still
0.05% — but with `gpt-5.5` the difference is €1,749 versus €8,750, and that's a figure that does
need to be defended in front of a CFO. **The order of magnitude of the argument doesn't change; the
honesty of the figure does.**

**The lever, measured but not implemented.** The filter is deterministic and free: a row with no
catalog name at all (`findNames`) is not a bolted fastener and doesn't need the model. Measured
over the 79 rows we have — 15 real and 64 synthetic, with 2 out-of-family planted on purpose:

| | Result |
|---|---|
| False negatives (bolted-fastener rows that would be skipped) | **0 of 79** |
| False positives (call paid unnecessarily) | **0 of 79** |
| Calls saved on the synthetic set | 3 of 64 |

A filter by **name or standard** wouldn't work: the flange in row 56 carries `ASTM A105`, the
standards regex recognizes it, and the call would be paid again. It has to be by catalog name only.

**Why it isn't implemented yet, and what its failure mode is.** The risk is a bolted-fastener row
written with an alias that isn't in the table: it would be skipped. It doesn't disappear — it comes
out as `OUT_OF_FAMILY` in the queue set aside for P-9 — so the cost of the failure is **one review,
not a wrong purchase**. Even so, it changes the semantics of P-9 (today the out-of-family verdict is
given by the model; with the filter it would be given by a table in 80% of cases) and that's a
product decision that deserves its own measurement, not a last-minute patch before delivery. It goes
in as the first line of `07-target-solution.md`.

## Model comparison (OpenAI)

| Configuration | Silent error | Autonomy | Split | €/row | model s/row | Reps |
|---|---|---|---|---|---|---|
| **gpt-5.5** | **0.0%** | 50.0% | 100% | 0.0235 | avg 44.0 · range **6.9–64.5** | 3 |
| **mixed 5.5/5.4** | **0.0%** | 50.0% | 100% | 0.0192 | 6.4 | 1 |
| gpt-5.4 | 6.7% | 46.7% | 100% | 0.0145 | 2.6 | 1 |
| gpt-5.4-nano | 30.8% | 30.0% | 100% | 0.0179 | 3.2 | 1 |
| gpt-5.4-mini | **50.0%** | 23.3% | 100% | 0.0102 | 2.1 | 1 |

### What it costs to downgrade the model

`gpt-5.4-mini` doesn't fail randomly. In rows 1 and 5 **the washer carries no quality** — the cause
of 87% of the review queue — and mini filled in the quality with `ASTM F436`, which is the
*standard*. The line came out **RESOLVED** instead of going to review: wrong material on site, and
nobody detects it because the line looks resolved.

And the span checker **doesn't catch it**, because `ASTM F436` is indeed in the text. The failure is
one of **attribution**, not invention. This is the gap that justifies the critic (SPEC-006).

`gpt-5.4` fails once out of fifteen, and also on the expensive side: it dropped the `zincado`
(zinc-plated) from row 6, so it would buy a bare bolt instead of a zinc-plated one — which, by the
no-mixing rule, is a different material.

### Mixed routing

`gpt-5.5` for the 9 multi-element rows, `gpt-5.4` for the 6 simple ones. Deterministic router, 0
calls to decide. Result: **same silent error (0%), same autonomy (50%), 18% cheaper**. Latency
with a single repetition came out at 6.4 s/row, but a single latency measurement isn't a measurement.

## Latency is not measurable with a single pass

`gpt-5.5` gave **6.9, 44, and 64.5 s/row** across three identical runs: a factor of 9.

That invalidates an argument I had built myself: I said `5.5` was ~10× slower than `5.4` based on a
measurement of 24.8 s/row, and the next pass gave 7.4 s under the same conditions. **Cost is stable
(±5%) because tokens are nearly deterministic; latency is not at all.**

Consequence for the commitment to the client: latency cannot be promised with this model, because
the variance belongs to the provider and isn't something I control. What can be promised is
throughput with a margin and a plan for when it goes out of range. The "minutes for 1,000 lines"
figure has to come with its range, not as a single number.

## The critic: first result, and it's negative

`openai/gpt-oss-120b` via OpenRouter, 9 multi-element rows, on the mixed pipeline that without the
critic gave 0% silent error.

| | Without critic | With critic |
|---|---|---|
| Silent error | 0.0% | 0.0% |
| **Useful autonomy** | **50.0%** | **26.7%** |
| **Queue noise** | **0.0%** | **31.8%** |
| Status agreement | 100% | 76.7% |
| Cost | — | $0.0015 / 9 calls |
| Latency | — | 14.5 s per call |

**It degraded 7 of the 8 correctly resolved lines**: 2.1, 3.1, 4.1, 6.1, 7.1, 7.2, 9.1. All of them
are marked correct by the gold set.

And a telling domain failure: on row 8 it flagged that "the material=ZN fields are missing on lines
8.2 and 8.3." `ZN` is a **finish** (zinc-plated), not a material. The critic doesn't distinguish the
two attributes.

**By the acceptance criterion I wrote myself in SPEC-006 — "if it doesn't measurably lower silent
error, it's removed" — this critic gets removed.** It doesn't lower anything (it was already at 0)
and it raises queue noise to 31.8%, which is exactly the failure the brief calls invisible: if the
queue fills with noise, the buyer stops looking at it and the protection against the expensive error
is lost too.

### What this experiment does measure, and what it doesn't

It measures the **false-positive rate**, and it's unacceptable: 7 of 8.

**It doesn't measure the hit rate**, because on a pipeline with 0% silent error the critic has
nothing to find. Measuring a safety net on an error-free pass can only measure its false alarms.

## The experiment that does measure the hit rate

The critic against `gpt-5.4-mini`'s output, which has **7 known real errors**.

| | Without critic | With critic |
|---|---|---|
| Silent error (rate) | 50.0% (7/14) | **62.5%** (5/8) |
| Bad resolved lines (count) | **7** | **5** |
| Useful autonomy | 23.3% | 10.0% |
| Queue noise | 18.8% | 31.8% |

Breakdown of the 6 lines it degraded, against the 7 real errors:

| | Lines | |
|---|---|---|
| **Hits** | `1.3`, `5.3` | **2** — the washers with `ASTM F436` put in the quality field |
| False positives | `2.1`, `7.1`, `7.2`, `9.1` | 4 |
| Missed | `1.1`, `1.2`, `5.1`, `5.2`, `12.1` | 5 |

**Recall 29% · Precision 33%.**

### The concept works; the implementation doesn't get there

The two hits are exactly the ones I predicted only this component could catch: the washer with no
quality that `mini` gave a **standard** in the quality field. No other stage sees it — the span
checker doesn't either, because `ASTM F436` is indeed in the text. So the gap exists and the critic
covers it.

The five it misses are the subtler variant: `ASTM A193, GR B7` as quality, where the value
**contains** the correct grade with the standard stuck in front of it. It's a harder error to spot
than plain `ASTM F436`.

## A flaw in my own KPI, uncovered by this experiment

**My primary metric is a rate, and that's why it says the critic makes things worse when it's
actually making them better.**

In absolute count the critic removed **2 bad lines and 4 good ones** from the resolved set. The
numerator dropped from 7 to 5 — two fewer expensive errors — but the denominator dropped from 14 to
8, so the *rate* rose from 50% to 62.5%.

And the two things it removes aren't worth the same, which is the premise of the whole case:

| | Count | Unit cost |
|---|---|---|
| Expensive errors avoided | 2 | 3–8 weeks of delay on a work front |
| Unnecessary reviews added | 4 | ~90 s of buyer time ≈ €3.5 in total |

With that asymmetry the trade-off is overwhelmingly good, and my primary metric reads it as a
regression. **The rate needs to be accompanied by the absolute count of expensive errors avoided**,
or the KPI penalizes exactly the component that protects against the costliest error.

What does remain a real problem, and not a measurement one, is the **31.8% queue noise**: the brief
warns that a noisy queue makes the buyer stop looking at it, and that destroys the entire
protection. No per-line cost captures that systemic effect.

### Verdict

The component **stays, but not in this state.** Next is the prompt, because the four false positives
all have the same shape: it flags empty fields — I explicitly told it that an empty field is not an
error — and it confuses finish with material. If after hardening it precision doesn't rise above
70%, the model at the `critic` level gets changed; and if that doesn't work either, it gets removed
and documented in `08-not-done.md`.

### Resolution · 2026-08-22: the prompt wasn't the fix, the effort was

The lever turned out not to be the prompt but the **reasoning effort**: gpt-oss spends its clock on
thinking tokens, and the critic was inheriting the extractor's effort level. With its own dial set
to `high`:

| | Default | `high` |
|---|---|---|
| Recall | 29% | **43%** |
| Precision | 33% | **100%** |
| False positives | 4 | **0** |
| Silent error (count) | 7 → 5 | **7 → 4** |
| Noise added | +31.8% | **+12.5%** |

The new hit is the one that was here called "the subtle variant" and used to be missed: `ASTM A193,
GR B7` as quality, with the standard stuck in front of the grade. The 4 that still get away are all
the same root cause — `mini` invented the washer's absent quality — and catching it is *failing
more closed* (target solution, line 2), not this component.

It passes the stopping criterion I wrote myself above (precision ≥70% → 100%) **with the same cheap
model**: the hypothesis "the model lacks domain judgment" is refuted — what it lacked was thinking
budget — and the argument that the critic is the right place for the open model survives. Detail in
`10-benchmarks.md` §5-ter.

### Hypotheses, in order of likelihood

1. **The prompt.** It's a first draft. The failures have the shape of a misunderstood instruction: I
   explicitly told it an empty field is not an error, and it flags empty fields; and it confuses
   finish with material, a distinction the prompt doesn't explain.
2. **The model.** `gpt-oss-120b` may lack the domain judgment needed. But if an expensive model is
   needed here, the argument that the critic is the natural place for the cheap model falls apart,
   and with it the component's economics.
3. **The component.** Maybe post-hoc verification is the wrong approach and the effort would pay off
   better by hardening the extractor's prompt.

## Another KPI flaw, of the same kind: the denominator had rows that weren't mine · 2026-08-22

Of the same kind as the previous one — a figure that moves because of something that isn't the
system's quality — but found by reading the brief again, not by measuring.

**The brief says nothing about rows that aren't bolted fasteners.** Checked against the PDF, not my
transcription: §2 says *"A single family: bolted fasteners"* and stops there; in
`reglas_tornilleria.md` the word "family" only appears in the title; and it doesn't even appear in
the six open points of §10. It's entirely my own decision (P-9), and it was half-done.

**What was wrong, in two places.**

1. **The queue.** `OUT_OF_FAMILY` carried `kind: MISSING_IN_SOURCE`, so a flange ended up marked
   *"Back to engineering."* Engineering has nothing to fix on that row: it's complete and well
   written, it just isn't part of this family. It would be sent back to the buyer, and in the
   meantime it's noise in a queue the brief explicitly says must be kept clean. It's now its own
   `kind`, `OUT_OF_SCOPE`, and a fourth queue: *"Not bolted fasteners."*
2. **The denominator.** `useful_autonomy` divided by *all* gold lines, and `queue_noise` by *all*
   review lines. With that, an MTO with more flanges gets worse autonomy without the system having
   done anything worse: the metric moved with the composition of the file. Now both rates are over
   lines **within the family**, and the out-of-family ones are reported separately.

**What doesn't change, on purpose.** The exclusion is decided by the gold, never by the system. If
the system discards a real bolt as "another family," that line **stays** in the denominator: it's
its own coverage gap, not a foreign row. The two kinds of disagreement come out named in
`pnpm run eval` (`missed` and `falsePositives`) because they don't cost the same — one is the
3–8-week error and the other a review.

**Effect on the published figures: none.** The 15-row gold has 0 out-of-family rows, so the numbers
above don't move. It changes on blind-set day, where P-9 is bet #12. Anchored in
`src/pipeline/__tests__/validate-out-of-family.test.ts`.

## Row 63, found while reviewing a quantity · 2026-08-22

The question was whether it was correct for a set of 30 bolts to yield 60 washers. It was — the row
says "2 washers," and that's 2 × 30, the same arithmetic as the brief's example — but the row had
two other things going on.

```
63 | Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado | 30 uds

before                                                          after
63.1 TORNILLO  30  M20    8.8    CINCADO   ✅                  same
63.2 TUERCA    30  10     —      —         ⚠️ QUALITY_MISSING  30  M20ᵉ  10     ⚠️ policy only P-1
63.3 ARANDELA  60  125    200HV  —         ⚠️ policy only P-1  60  M20ᵉ  200HV  ⚠️ policy only P-1
```

The nut's quality (`10`, G9) and the washer's standard number (the `125` in `DIN 125`) had
ended up in the **measure** field. And since both secondary elements "had" a measure, the §2
extrapolation never applied the `M20` they should have gotten.

**The important part isn't the failure, it's that it slipped past all four safeguards.** The spans
pass (the digits are in the row), confidence came out at **0.95** (everything read literally),
`detectGaps` doesn't scan measures and the standard was correctly placed, and the critic **never ran**.
The washer was one policy flag away from coming out RESOLVED with a measure of 125 — the 3-to-8-week
error.

Fixed with P-10 and P-11 in `03-policies.md`, without a model: they're closed by §6 (a measure is
either imperial or metric, and there's no equivalence between the two) and §2 (measure is the only
thing that carries over within a set).

### And why the critic didn't run: it was failing silently

`maxTokens: 2048` against a level that reasons with `effort=high`, and on OpenRouter the thinking
tokens come out of that same budget. It was truncated, the exception was swallowed, and the row came
back with `ran: false` — indistinguishable from "not eligible." **The harder the row, the more
likely the safety net was to disappear.** On the synthetic set: 3 of 4 eligible. The missing one was
row 63.

Budget raised to 8,192 and `CriticResult.failure` added to separate the two cases. Failures are
counted, named in both scripts, and shown in the buyer's panel. Now 4/4, and 9/9 on the real MTO.

### Effect on the figures

On the 15-row gold, **none**: split 100%, silent error 0%, useful autonomy 50%, queue noise 0%,
status agreement 100%, exact reasons 100% — identical. Neither of the two gold rows has a set with
this pattern. On the synthetic set, `QUALITY_MISSING` drops from 7 to 6 and two lines go from an
invented measure to the correct measure marked as extrapolated.

That the gold doesn't move is the uncomfortable fact and it needs to be said in the session: **the
15-row set would never have caught this.** It was caught by the synthetic set, and only because
someone looked at a quantity.

## Pending

- [ ] Repetitions of the mixed and `5.4` configurations (blocked: no API credit).
- [ ] Harden the prompt at the point where `mini` failed (a standard is not a quality) and re-measure
      all three. The current comparison uses a prompt tuned on `5.5`, so it measures
      "mini with 5.5's prompt," not mini's actual capability.
- [ ] Diff of `5.4` against `5.5` over the 64 synthetic rows, manually adjudicating only the
      discrepancies. Multiplies the sample by 2.4 without having to label 71 lines.
- [ ] The critic, and with it the second axis of silent error.

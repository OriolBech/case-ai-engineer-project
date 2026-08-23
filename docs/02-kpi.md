# KPI

> Status: 🚧 skeleton. Closed on day 1 and filled in with numbers on day 4.
> Feeds section 1 of the 2-pager. The brief requires answering four things: what you measure
> against, what you measure, what you commit to, and where the threshold sits.

## 1. What I measure against

| | |
|---|---|
| **Source** | Gold set hand-labeled over the 15 rows of the given MTO → 30 lines × **8 cells** (7 attributes + quantity) |
| **Method** | Double blind pass with a rest period between passes |
| **Measured self-consistency** | _pending_ % — second blind pass without opening `gold.jsonl`. It is the lower bound of the human error rate, and without it the 100% above has nothing to compare against |
| **Cells marked CERTAIN** | **211** / 240 (88%) |
| **POLICY-DEPENDENT cells** | **29** / 240 (12%) |
| **Robustness set** | 40–60 synthetic rows generated from the rules, not from the MTO. Not looked at until day 4. |

**Why I trust it, and how far.** 87% of the cells are deduced from `reglas_tornilleria.md`
or from the brief, and each one carries the rule that produced it. The remaining 13% depends on a
declared policy and is reported separately. The limitations, stated before anyone else states them:
the second blind pass is still missing, it hasn't been reviewed by a buyer with twenty years of
experience, and it's 30 lines — enough to steer development and catch regressions, not enough for a
tight confidence interval. That's why the commitment is argued from the cost of the two errors, not
from this percentage.

**What the gold set has already changed about the KPI.** 87% of the review queue comes from a single
cause: the MTO doesn't state the quality/grade of the nuts and washers in a set (`MISSING_IN_SOURCE`).
No model can fix that. So the primary metric can't be "% of lines resolved": it has to be
**% resolved out of what is resolvable**, plus an actionable list of what engineering needs to fix.
Promising 90% autonomy on this data would be promising to make things up.

**Sensitivity.** **No policy moves more than 3 lines out of 30.** The worst is P-4 (imperial length
without a unit), which with `review` drops autonomy from 50% to 40%. That means the committed number
doesn't hinge on a debatable decision but on the structure of the data, which is what makes it
defensible to have asked only two questions. Detail in `../data/gold/gold.md`.

## 2. What I measure

### Primary · Silent error — rate **and count**

```
silent_error_rate  = RESOLVED lines with ≥1 attribute different from gold / total RESOLVED
silent_error_count = RESOLVED lines with ≥1 attribute different from gold
```

This is the metric for the 3–8 week error. A wrong attribute in a resolved line is caught by no one
until the material reaches the site.

**Both are reported, and I found out why by measuring the critic.** A rate alone lies when a
component removes both good *and* bad lines from the resolved set: the critic removed 2 bad ones and
4 good ones, the count dropped from 7 to 5 —two fewer costly errors— and the rate rose from 50% to
62.5%. In other words, the rate was penalizing exactly the component that protects against the
costliest error.

And the two things it removes aren't worth the same: 2 costly errors avoided versus 4 unnecessary
~90 s reviews. Given the asymmetry in the brief, that change is clearly good. A KPI that can't see
that isn't useful for deciding.

### Secondary · Useful autonomy

```
useful_autonomy = RESOLVED lines correct in all 7 attributes / output lines OF THE FAMILY
```
This is the metric that buys hours. It only rises if the system both resolves *and* gets it right: a
system that sends everything to review sits at 0.

> **Joint-reading notice.** The silent error **can only be interpreted together with split
> fidelity**. When the split fails, the lines don't align with gold and the harness compares fewer
> lines, so a model that can't split sets correctly ends up with a favorably low silent error rate.
> Below 100% split, the figure isn't reliable. This was discovered during the model sweep: three
> models with 0% silent error had splits of 40%, 60%, and 93%.

### Constraint · Set-explosion fidelity

```
split_fidelity = MTO rows with the correct number of output lines / MTO rows
```
This is reported **separately** and not averaged with the rest: a failure here isn't a wrong
attribute, it's a material that nobody buys.

### Queue noise

```
queue_noise = MANUAL_REVIEW lines that gold considers correct / total MANUAL_REVIEW of the family
```
The metric for the "invisible failure": if this rises, the buyer stops looking at the queue and the
protection against the costly error is lost too.

### The denominator: what does NOT go in, and why (P-9)

The two rates above are calculated **over the fastener lines**. A flange or a gasket that gold
declares to belong to another family isn't in the denominator of either.

This isn't an exclusion of convenience; it's that both alternatives lie. Counting it as unresolved
penalizes the system for the one thing it can do right with it —refuse it— and makes the number move
with however many flanges the MTO happens to bring, which isn't a property of the system. Counting it
as resolved would be the expensive lie. It goes separately, in its own figure.

And **the exclusion is decided by gold, never by the system**, because otherwise the system could
erase its own failures by calling a real bolt "another family." The two kinds of disagreement are
reported separately and don't cost the same:

| Disagreement | What it is | Cost |
|---|---|---|
| `missed` — gold says another family, the system produces lines | Seven made-up attributes on a flange | The 3–8 week error. It also shows up as a silent error. |
| `falsePositives` — the system discards what gold says is a fastener | A bolt nobody buys | A review, not a purchase. **It stays inside the denominator**: it's a coverage gap, not an unrelated row. |

Implemented in `src/eval/harness.ts` (`outOfScope`) and visible in `pnpm run eval`.

### Operational metrics (required by the brief) — MEASURED

`pnpm run cost` (forces cache disabled: measuring against the cache would measure the cache).

**Rates**: developers.openai.com/api/docs/pricing, checked 2026-08-22.
`gpt-5.5` 5.00 / 30.00 USD per million (input / output), input cache 0.50.
`gpt-5.4-mini` 0.75 / 4.50, cache 0.075. EUR/USD 1.1679 (ECB, 2026-08-21).

| | Measured over the 15 rows |
|---|---|
| Tokens per row | **1,730 input / 652 output** |
| Cost per row | **€0.024** ($0.0279) |
| Model time per row | **24.8 s** |

**Extrapolated to the volumes in the brief** (4,000 fastener rows per revision, 25
revisions):

| | Per revision | Per project |
|---|---|---|
| System, with prompt caching | **€69** | **€1,726** |
| Manual baseline (90 s/row, €35/h loaded) | €3,500 | €87,500 |
| | | **the system is 2.0%** |

**Latency for 1,000 lines** (2.00 lines per row measured → 500 rows):

| Concurrency | 6 | 16 | 32 | 64 |
|---|---|---|---|---|
| Minutes | 34.5 | 12.9 | **6.5** | 3.2 |

### The two cost findings that change decisions

**96% of the cost at scale is OUTPUT tokens.** Direct consequence: caching more input buys almost
nothing, and the system prompt —which looked like the expense— is irrelevant. The two real levers
are making the output more compact and choosing the model.

**The cheap model comes out 6.7× cheaper**: €259 per project versus €1,726. But that isn't yet a
decision: it still needs measuring how much accuracy is lost, and with the costly error running 3 to
8 weeks of site delay, €1,500 of savings per project doesn't buy off even one failure. It's measured
on day 4 and goes into the 2-pager as a comparison, not an intuition.

And the overall framing holds up with the real numbers: **inference cost is not the constraint.** It's
2% of the manual baseline, and the difference between the expensive model and the cheap one is
€1,500 per project versus €87,500 of baseline. The thing to optimize isn't cost; it's accuracy.
- **Per-attribute breakdown** of the four metrics above.

## 3. What I commit to

Available inputs: 20,000 rows/MTO, 15–25% fasteners, up to 25 revisions, 90 s/row,
6 people, cost of the two errors.

| Quantity | Calculation | Value |
|---|---|---|
| Fastener rows per MTO | 20,000 × 20% | 4,000 |
| Rows **read** per revision | all 20,000: they must be read to know which ones are fasteners | 20,000 |
| Person-hours per full revision | 4,000 × 90 s | **100 h** |
| Person-hours per project | 100 h × 25 revisions | **2,500 h** |
| Manual baseline per project | 2,500 h × €35/h loaded | **€87,500** |
| Cost of an unnecessary review | 90 s × €35/h | **€0.875** |
| Cost of a false resolve | 3–8 weeks of a front stalled | see below |

### The figure that decides the whole design is a ratio, not a cost

The brief doesn't put a euro figure on the 3–8 weeks, and it doesn't need to: what decides the
design is the **ratio** between the two errors, and that can be bounded from below with what we
are given.

An unnecessary review costs **€0.875**. A silent error stalls a work front for 3 to 8 weeks.
Without knowing crew size or contractual penalties, the defensible floor for "3 weeks with a front
stopped" is on the order of **tens of thousands of euros**. Taking €20,000
as a conservative bound:

**Ratio ≈ 20,000 / 0.875 ≈ 23,000 to 1.**

That number, not a precision threshold, is what needs to sink in. It means it's
**worth sending twenty-three thousand lines to review to avoid a single silent error**. And a whole
full revision is 4,000 lines. In other words: at the real cost of the two errors, **reviewing
everything is cheaper than one silent error per year**.

From that follows, without further discussion, the shape of the commitment: you can't promise
*"silent error below 2%"*, because 2% over 4,000 lines is 80 costly errors per revision. At this
ratio, the only defensible figure is **zero**, and the only way to commit to zero isn't getting more
right: it's **not resolving what can't be justified**.

### The commitment

| # | Commitment | Measured today | How it's falsified |
|---|---|---|---|
| 1 | **Zero silent errors on certain cells.** No line comes out `RESOLVED` with a value the client's rules decide otherwise | **0 of 15 resolved** · 211/211 certain cells · 0 hallucinations | `pnpm run eval` on any labeled MTO |
| 2 | **Every uncovered case comes out flagged, not resolved.** A value no table recognizes is a policy gap, not a silent default | 0 gaps in the given MTO (the policies were written against it) · 17 in the synthetic set, none false | `pnpm run gaps`, deterministic and over 100% of the rows |
| 3 | **Useful autonomy ≥ 45%** — lines resolved *and* correct | **50.0%** | `pnpm run eval` |
| 4 | **Cost ≤ €0.001 per row read**, i.e. **≤ €50 per project** for 500,000 reads | €0.000095/row → **€48/project** | `pnpm run cost` with `LLM_CACHE=off` |
| 5 | **Throughput, not latency.** See §3-bis | — | — |

**What commitment 1 doesn't say, and needs to be said.** It's measured on 30 lines I labeled myself,
and the quantity cell went eighteen hours without being compared even though it's the only one where
an error *multiplies* the order (`05-results.md`). So the strong commitment isn't the figure, it's
**commitment 2**: the mechanism by which an unknown case comes to light instead of being resolved.
Number 1 is falsifiable with a blind set; number 2 is structural and can be audited by reading the
code.

**And the ratio trims commitment 3 in the right direction.** At 23,000 to 1, raising autonomy from
50% to 70% saves 20% × 2,500 h × €35 = **€17,500 per project**, and a single silent error eats it
whole. That's why autonomy is **secondary** and comes with a floor, not a target: any autonomy
improvement that raises the silent error is a bad improvement, even if both figures rise in
aggregate.

## 3-bis. Latency: what isn't promised, and what is promised instead

The brief asks for *"latency to process a thousand rows."* The honest answer is that **that figure
isn't promisable**, and the data proving it has been measured: `gpt-5.5` gave **6.9 · 44.0 · 64.5
s/row** across three identical runs. A factor of 9, from the provider, not from us.

At concurrency 8, a thousand rows come out like this:

| | s/row | 1,000 rows |
|---|---|---|
| Best measured run | 6.9 | **~15 min** |
| Worst measured run | 64.5 | **~2.2 h** |

Giving the average (44 s → 1.5 h) would be the methodological error this project already paid for
once: an argument was built on a single 24.8 s measurement and it didn't survive the second one.

**What is promised**, because it depends on us and not on the provider:

- **It's a batch process, not an interactive one.** No one waits in front of the screen: the MTO
  goes in and the review queue comes out. Per-row latency isn't the business metric; **throughput**
  is.
- **It scales with concurrency**, which is a parameter of ours. The limit is the provider's rate
  limit, not the design.
- **A range with its plan.** If the provider drifts out of range, the `main` tier is repointed to
  another one with an environment variable, and `pnpm run providers:check` validates it before
  starting. Cost is stable (±5%) because tokens are nearly deterministic; latency isn't at all.

## 4. Where the threshold sits

**The threshold isn't a number.** It's the **weakest admissible provenance** for a resolved line.

That's the decision, and the form matters as much as the placement: a confidence scalar can't be
argued with a buyer, but a boundary expressed in provenances can. The flag is
`THRESHOLD_MIN_PROVENANCE` and it's hot-switchable.

### Where it sits, and why exactly there

The nine provenances, ordered, with the boundary marked:

| Provenance | What it means | Does it resolve? |
|---|---|---|
| `exact_catalog` | The value is written and is in a closed catalog of the client's | yes |
| `table_normalized` | Alias recognized by a client table (`DIN 931` → `ISO 4014`) | yes |
| `extracted` | It's written literally; there's no catalog to corroborate it against (`M20`, `DIN 975`) | yes |
| `extracted_uncatalogued` | Marked as a grade but outside the list (`GR B7`) — §5 says to extract it as-is | yes |
| `extrapolated` | The measurement inherited within the set — **the only extrapolation the rules allow** (§2) | yes |
| `derived` | Material deduced from the grade — **policy P-3, and the client answered it** | yes |
| `inferred` | Multiplicity or length unit assumed — **P-2 and P-4, both with their rule written down** | yes ← **the threshold sits here** (`THRESHOLD_MIN_PROVENANCE=inferred`) |
| ↓ below the threshold ↓ | | |
| `absent` | Not in the MTO. Nothing a model can fix: goes back to engineering | **no**, never |
| `not_applicable` | Doesn't apply (length of a nut, §7). It isn't an absence | not a gap |

**The argument, in one sentence:** the boundary separates **what has a written rule behind it** from
**what isn't there at all**. Everything admissible —including `inferred`— is traceable to a value in
the row plus a closed client table, a question the client answered, or a policy of ours that is
**declared, switchable, and has its volume measured** in `03-policies.md`. `absent` is the only one
with nothing behind it, and it never gets resolved.

**Why `inferred` falls inside and not outside.** It's the case a buyer would question most, and the
answer is the volume: it's **3 cells out of 240** (the unit for imperial lengths, P-4) plus the
unwritten multiplicities from P-2, which **don't block but get flagged** and are confirmable in bulk
in the front end. And what P-4's rule can't separate **isn't resolved incorrectly**: it falls to
review with `LENGTH_UNIT_IMPLAUSIBLE`. In other words, `inferred` doesn't mean "the system has
guessed," it means "a physical-range rule decided it, and whatever didn't fit the range is in your
queue."

And at 23,000 to 1, this is what the threshold **can't** be: a probability. **A probability
calibrated at 99% is still 40 costly errors per 4,000 lines**, and at this ratio that's indefensible.
What's defensible is a rule a buyer can repeat out loud: *"the system resolves what's written in the
MTO, plus what your tables say it means, plus three rules you have written down and can switch off.
What isn't there, you see it."*

**Why `derived` falls on the good side.** It's the debatable case, because the material **isn't**
written in the row: it's deduced from the grade. It's above the threshold for a reason that isn't
technical — **it's question Q3, and the client answered it**. The provenance is recorded and the flag
`POLICY_MATERIAL_DERIVATION=off` moves it to the other side on the fly. If the client changes their
mind, it's a configuration change, not a code change.

**Why `extrapolated` falls on the good side even though it's an extrapolation.** Because it's the
only one the client's rules explicitly authorize (§2, the measurement within a set), and confirmed by
the client on 2026-08-22. It's not our criterion: it's theirs.

### And it's falsifiable, which is what makes it a decision and not an opinion

Every move of the threshold has its measured delta, and it can be demonstrated live:

| Move the threshold | Measured effect |
|---|---|
| `THRESHOLD_MIN_PROVENANCE=derived` (raise it one notch: `inferred` out) | Equivalent to the next two rows combined |
| `POLICY_UNITLESS_LENGTH=review` | Autonomy **50% → 40%**. Affects **3 of 240** cells |
| `POLICY_MATERIAL_DERIVATION=off` (raise it above `derived`) | Autonomy **→ ~0%**. Affects 14 of 15 rows |
| `POLICY_FINISH_SET_SCOPE=review` | 4 of 15 rows to review with `FINISH_SCOPE_UNSTATED` |

The second row is the one that shows why asking the client about the material was worth it: without
that answer, the system has zero autonomy and the whole project buys nothing.

## What this KPI deliberately discards

- **Plain accuracy.** The brief discards it: 100% correct with 90% sent to review is useless, and
  100% resolved with 85% correct is worse than nothing.
- **F1 over the two errors.** It would treat the two errors as equivalent when they differ by
  two orders of magnitude in cost.

# KPI

> Status: 🚧 skeleton. Closed on day 1 and filled in with numbers on day 4.
> Feeds section 1 of the 2-pager. The brief requires answering four things: what you measure
> against, what you measure, what you commit to, and where the threshold sits.

## 1. What I measure against

| | |
|---|---|
| **Source** | Gold set hand-labeled over the 15 rows of the given MTO → 30 lines × **8 cells** (7 attributes + quantity) |
| **Method** | Double blind pass with a rest period between passes |
| **Measured self-consistency** | _pending_ % — second blind pass without opening `gold.jsonl`. It's the lower bound on the human error rate, and without it the 100% above has nothing to be compared against |
| **Cells marked CERTAIN** | **211** / 240 (88%) |
| **POLICY-DEPENDENT cells** | **29** / 240 (12%) |
| **Robustness set** | 40–60 synthetic rows generated from the rules, not from the MTO. Not looked at until day 4. |

**Why I trust it, and up to what point.** 87% of the cells are deduced from `reglas_tornilleria.md`
or the brief, and each one carries the rule that produced it. The remaining 13% depends on a
declared policy and is reported separately. The limitations, stated before anyone else states them:
the second blind pass is missing, it hasn't been reviewed by a buyer with twenty years in the
trade, and it's 30 rows — enough to steer development and catch regressions, not enough for a tight
confidence interval. That's why the commitment is argued from the cost of the two errors, not from
this percentage.

**What the gold set has already changed about the KPI.** 87% of the review queue traces to a single
cause: the MTO doesn't write down the quality of the nuts and washers in a set
(`MISSING_IN_SOURCE`). No model fixes that. So the primary metric can't be "% of lines resolved":
it has to be **% resolved out of what's resolvable**, plus the actionable list of what engineering
needs to fix. Promising 90% autonomy on this data would be promising to make things up.

**Sensitivity.** **No single policy moves more than 3 lines out of 30.** The worst is P-4 (imperial
length with no unit), which with `review` drops autonomy from 50% to 40%. That means the committed
number doesn't hang on a debatable decision but on the structure of the data, and that's what makes
it defensible to have only asked two things. Detail in `../data/gold/gold.md`.

## 2. What I measure

### Primary · Silent error — rate **and count**

```
silent_error_rate  = RESOLVED lines with ≥1 attribute different from the gold / total RESOLVED
silent_error_count = RESOLVED lines with ≥1 attribute different from the gold
```

It's the metric for the 3–8 week error. A wrong attribute on a resolved line goes undetected by
everyone until the material reaches the site.

**Both come along, and I discovered why by measuring the critic.** A rate alone lies when a
component removes both good *and* bad lines from the resolved set: the critic removed 2 bad ones and
4 good ones, the count dropped from 7 to 5 — two fewer costly errors — and the rate rose from 50%
to 62.5%. In other words, the rate was penalizing exactly the component that protects against the
most costly error.

And the two things it removes aren't worth the same: 2 costly errors avoided versus 4 unnecessary
~90 s reviews. Given the brief's asymmetry, that change is clearly good. A KPI that can't see that
isn't useful for deciding.

### Secondary · Useful autonomy

```
useful_autonomy = RESOLVED lines correct across all 7 attributes / total output lines
```
It's the metric that buys hours. It only goes up if the system resolves *and* gets it right: a
system that sends everything to review scores 0 on it.

> **Joint-reading warning.** Silent error **can only be interpreted alongside split fidelity**.
> When the split fails, the lines don't align with the gold and the harness compares fewer lines,
> so a model that can't split sets properly gets a favorably low silent error. Below 100% split,
> the figure isn't reliable. This was discovered during the model sweep: three models with 0%
> silent error had splits of 40%, 60%, and 93%.

### Constraint · Set-explosion fidelity

```
split_fidelity = MTO rows with the correct number of output lines / MTO rows
```
Reported **separately** and not averaged with the rest: a failure here isn't a wrong attribute,
it's a material nobody buys.

### Queue noise

```
queue_noise = REVISION_MANUAL lines the gold considers already correct / total REVISION_MANUAL
```
The "invisible failure" metric: if this goes up, the buyer stops looking at the queue and the
protection against the costly error is lost too.

### Operational metrics (required by the brief) — MEASURED

`npm run cost` (forces the cache off: measuring against the cache would measure the cache).

**Pricing**: developers.openai.com/api/docs/pricing, checked 2026-08-22.
`gpt-5.5` $5.00 / $30.00 per million (input / output), input cache $0.50.
`gpt-5.4-mini` $0.75 / $4.50, cache $0.075. EUR/USD 1.1679 (ECB, 2026-08-21).

| | Measured over the 15 rows |
|---|---|
| Tokens per row | **1,730 input / 652 output** |
| Cost per row | **€0.024** ($0.0279) |
| Model time per row | **24.8 s** |

**Extrapolated to the brief's volumes** (4,000 fastener rows per revision, 25
revisions):

| | Per revision | Per project |
|---|---|---|
| System, with prompt cache | **€69** | **€1,726** |
| Manual baseline (90 s/row, €35/h fully loaded) | €3,500 | €87,500 |
| | | **the system is 2.0%** |

**Latency for 1,000 lines** (2.00 lines per row measured → 500 rows):

| Concurrency | 6 | 16 | 32 | 64 |
|---|---|---|---|---|
| Minutes | 34.5 | 12.9 | **6.5** | 3.2 |

### The two cost findings that change decisions

**96% of the cost at scale is OUTPUT tokens.** Direct consequence: caching more input buys almost
nothing, and the system prompt — which looked like the expense — is irrelevant. The two real
levers are making the output more compact and choosing the model.

**The cheap model comes out 6.7× cheaper**: €259 per project versus €1,726. But that isn't a
decision yet: how much accuracy is lost still needs measuring, and with the costly error running
3 to 8 weeks of site time, €1,500 in savings per project doesn't buy off even one failure. It gets
measured on day 4 and goes into the 2-pager as a comparison, not a hunch.

And the overall framing holds up under the real numbers: **inference cost is not the
constraint.** It's 2% of the manual baseline, and the difference between the expensive and the
cheap model is €1,500 per project versus an €87,500 baseline. Cost isn't what needs optimizing;
accuracy is.
- **Breakdown by attribute** for the four metrics above.

## 3. What I commit to

Available inputs: 20,000 rows/MTO, 15–25% fasteners, up to 25 revisions, 90 s/row,
6 people, cost of the two errors.

| Quantity | Calculation | Value |
|---|---|---|
| Fastener rows per MTO | 20,000 × 20% | 4,000 |
| Rows **read** per revision | all 20,000: they have to be read to know which ones are fasteners | 20,000 |
| Person-hours per full revision | 4,000 × 90 s | **100 h** |
| Person-hours per project | 100 h × 25 revisions | **2,500 h** |
| Manual baseline per project | 2,500 h × €35/h fully loaded | **€87,500** |
| Cost of an unnecessary review | 90 s × €35/h | **€0.875** |
| Cost of a false resolve | 3–8 weeks of a work front stalled | see below |

### The number that decides the whole design is a ratio, not a cost

The brief doesn't put a euro figure on the 3–8 weeks, and it doesn't need to: what decides the
design is the **ratio** between the two errors, and that can be bounded from below with what we
are given.

An unnecessary review costs **€0.875**. A silent error stalls a work front for 3 to 8 weeks.
Without knowing the crew size or the contractual penalty, the defensible floor for "3 weeks of a
stalled front" is on the order of **tens of thousands of euros**. Taking €20,000 as a conservative
bound:

**Ratio ≈ 20,000 / 0.875 ≈ 23,000 to 1.**

That's the number to internalize, not a precision threshold. It means it's **worth sending
twenty-three thousand lines to review to avoid a single silent error**. And one entire full review
is 4,000 lines. In other words: at the real cost of the two errors, **reviewing everything is
cheaper than one silent error a year**.

From that, without further discussion, comes the shape of the commitment: you can't promise
*"silent error below 2%,"* because 2% of 4,000 lines is 80 costly errors per review. At this ratio,
the only defensible figure is **zero**, and the only way to commit to zero isn't getting more
things right: it's **not resolving what can't be justified**.

### The commitment

| # | Commitment | Measured today | How it's falsified |
|---|---|---|---|
| 1 | **Zero silent errors on certain cells.** No line comes out `RESUELTA` with a value the client's rules would decide differently | **0 out of 15 resolved** · 211/211 certain cells · 0 hallucinations | `npm run eval` on any labeled MTO |
| 2 | **Every uncovered case comes out flagged, not resolved.** A value no table recognizes is a policy gap, not a silent default | 0 gaps in the given MTO (policies were written against it) · 17 in the synthetic set, none false | `npm run gaps`, deterministic and over 100% of rows |
| 3 | **Useful autonomy ≥ 45%** — resolved *and* correct lines | **50.0%** | `npm run eval` |
| 4 | **Cost ≤ €0.001 per row read**, i.e. **≤ €50 per project** for 500,000 reads | €0.000095/row → **€48/project** | `npm run cost` with `LLM_CACHE=off` |
| 5 | **Throughput, not latency.** See §3-bis | — | — |

**What commitment 1 doesn't say, and needs saying.** It's measured over 30 lines I labeled myself,
and the quantity cell went eighteen hours without being compared, being the only one where an
error *multiplies* the order (`05-results.md`). So the strong commitment isn't the number, it's
**commitment 2**: the mechanism by which an unknown case comes to light instead of being resolved.
Commitment 1 is falsifiable with a blind set; commitment 2 is structural and can be audited by
reading the code.

**And the ratio trims commitment 3 in the right direction.** At 23,000 to 1, raising autonomy from
50% to 70% saves 20% × 2,500 h × €35 = **€17,500 per project**, and a single silent error eats it
whole. That's why autonomy is **secondary** and comes with a minimum, not a target: any autonomy
improvement that raises silent error is a bad improvement, even if both figures go up in aggregate.

## 3-bis. Latency: what isn't promised, and what's promised instead

The brief asks for *"latency to process a thousand rows."* The honest answer is that **this
figure can't be promised**, and the data proving it has been measured: `gpt-5.5` gave **6.9 · 44.0 ·
64.5 s/row** across three identical passes. A factor of 9, from the provider, not from us.

With concurrency 8, a thousand rows come out like this:

| | s/row | 1,000 rows |
|---|---|---|
| Best measured pass | 6.9 | **~15 min** |
| Worst measured pass | 64.5 | **~2.2 h** |

Giving the average (44 s → 1.5 h) would be the methodological error this project already paid for
once: an argument was built on a single 24.8 s measurement and it didn't survive the second one.

**What is promised**, because it depends on us and not on the provider:

- **It's a batch process, not an interactive one.** Nobody waits in front of the screen: the MTO
  goes in and the review queue appears. Per-row latency isn't the business metric; **throughput**
  is.
- **It scales with concurrency**, which is a parameter of ours. The limit is the provider's rate
  limit, not the design.
- **A range with its own plan.** If the provider falls out of range, the `main` tier is repointed
  to another one with an environment variable, and `npm run providers:check` validates it before
  starting. Cost is stable (±5%) because tokens are nearly deterministic; latency isn't, at all.

## 4. Where the threshold sits

**The threshold isn't a number.** It's the **weakest admissible provenance** on a resolved line.

That's the decision, and the form matters as much as the placement: a confidence scalar can't be
argued over with a buyer, but a boundary expressed in terms of provenance can. The flag is
`THRESHOLD_MIN_PROVENANCE` and it can be toggled live.

### Where it sits, and why exactly there

The nine provenance levels, ordered, with the boundary inside:

| Provenance | What it means | Does it resolve? |
|---|---|---|
| `exact_catalog` | The value is written down and is in a closed client catalog | yes |
| `table_normalized` | Alias recognized by a client table (`DIN 931` → `ISO 4014`) | yes |
| `extracted` | Written literally; no catalog to corroborate it against (`M20`, `DIN 975`) | yes |
| `extracted_uncatalogued` | Marked as a quality grade but outside the list (`GR B7`) — §5 says to extract it as-is | yes |
| `extrapolated` | The size inherited within the set — **the only extrapolation the rules allow** (§2) | yes |
| `derived` | Material deduced from the quality — **policy P-3, and the client answered it** | yes |
| `inferred` | Assumed multiplicity or length unit — **P-2 and P-4, both with their rule written down** | yes ← **the threshold is here** (`THRESHOLD_MIN_PROVENANCE=inferred`) |
| ↓ below the threshold ↓ | | |
| `absent` | Not in the MTO. Nothing a model can fix: goes back to engineering | **no**, never |
| `not_applicable` | Doesn't apply (length of a nut, §7). It's not an absence | not a gap |

**The argument, in one sentence:** the boundary separates **what has a written rule behind it**
from **what isn't there**. Everything admissible — including `inferred` — traces back to a value
in the row plus a closed client table, a question the client answered, or one of our own policies
**declared, toggleable, and with its volume measured** in `03-policies.md`. `absent` is the only
one with nothing behind it, and it's never resolved.

**Why `inferred` falls inside and not outside.** It's the case a buyer would push back on the
most, and the answer is volume: it's **3 cells out of 240** (the unit for imperial lengths, P-4)
plus the unwritten multiplicities from P-2, which **don't block but do get flagged** and can be
confirmed in bulk from the front end. And what P-4's rule can't separate **doesn't get resolved
incorrectly**: it falls to review with `LENGTH_UNIT_IMPLAUSIBLE`. So `inferred` doesn't mean "the
system guessed," it means "a physical-range rule decided it, and whatever didn't fit the range is
in your queue."

And at 23,000 to 1, here's what the threshold **can't** be: a probability. **A probability
calibrated to 99% is still 40 costly errors per 4,000 lines**, and at this ratio that's not
defensible. What is defensible is a rule a buyer can repeat out loud: *"the system resolves what
the MTO says, plus what your tables say it means, plus three rules you have written down and can
turn off. What isn't there, you see for yourselves."*

**Why `derived` falls on the good side.** It's the debatable case, because the material **isn't**
written in the row: it's deduced from the quality. It's above the threshold for a reason that
isn't technical — **it's question Q3, and the client answered it**. The provenance stays recorded
and the `POLICY_MATERIAL_DERIVATION=off` flag moves it to the other side live. If the client
changes their mind, it's a configuration change, not a code change.

**Why `extrapolated` falls on the good side even though it's an extrapolation.** Because it's the
only one the client's rules explicitly authorize (§2, the size within a set), and confirmed by the
client on 2026-08-22. It's not our criterion: it's theirs.

### And it's falsifiable, which is what turns it into a decision instead of an opinion

Every move of the threshold has its measured delta, and it can be shown live:

| Moving the threshold | Measured effect |
|---|---|
| `THRESHOLD_MIN_PROVENANCE=derived` (raise it one notch: `inferred` out) | Equivalent to the two following rows combined |
| `POLICY_UNITLESS_LENGTH=review` | Autonomy **50% → 40%**. Affects **3 of 240** cells |
| `POLICY_MATERIAL_DERIVATION=off` (raise it above `derived`) | Autonomy **→ ~0%**. Affects 14 of 15 rows |
| `POLICY_FINISH_SET_SCOPE=review` | 4 of 15 rows to review with `FINISH_SCOPE_UNSTATED` |

The second row is the one that shows why the client question about the material was worth
asking: without that answer, the system has zero autonomy and the entire project buys nothing.

## What this KPI deliberately rules out

- **Plain accuracy.** The brief rules it out: 100% correct with 90% sent to review isn't useful,
  and 100% resolved with 85% correctness is worse than nothing.
- **F1 over the two errors.** It would treat the two errors as equivalent when they differ by two
  orders of magnitude in cost.

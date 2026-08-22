# KPI

> Status: 🚧 skeleton. Closed on day 1 and filled in with numbers on day 4.
> Feeds section 1 of the 2-pager. The brief requires answering four things: what you measure
> against, what you measure, what you commit to, and where the threshold goes.

## 1. What I measure against

| | |
|---|---|
| **Source** | Gold set labeled by hand over the 15 rows of the given MTO → ~40 lines × 7 attributes |
| **Method** | Double blind pass with a rest period between passes |
| **Measured self-consistency** | _pending_ % — this is the lower bound on the human error rate |
| **Cells marked CERTAIN** | _pending_ / _pending_ |
| **POLICY-DEPENDENT cells** | _pending_ / _pending_ |
| **Robustness set** | 40–60 synthetic rows generated from the rules, not from the MTO. Not looked at until day 4. |

**Why I trust it, and how far.** 87% of the cells are deducible from `reglas_tornilleria.md` or
from the brief, and each one carries the rule that produced it. The remaining 13% depends on a
declared policy and is reported separately. The limitations, stated before someone else states
them: the second blind pass is still missing, it hasn't been reviewed by a buyer with twenty years
in the trade, and it's 30 lines — enough to steer development and detect regressions, not enough
for a tight confidence interval. That's why the commitment is argued from the cost of the two
errors, not from this percentage.

**What the gold set has already changed about the KPI.** 87% of the review queue is a single
cause: the MTO doesn't state the quality of the nuts and washers in a set (`MISSING_IN_SOURCE`).
No model fixes that. So the primary metric can't be "% of lines resolved": it has to be **%
resolved out of what's resolvable**, plus an actionable list of what engineering must correct.
Promising 90% autonomy on this data would mean promising to invent data.

**Sensitivity.** **No policy moves more than 3 lines out of 30.** The worst is P-4 (imperial
length without a unit), which with `review` lowers autonomy from 50% to 40%. That means the
committed number doesn't hang on a debatable decision but on the structure of the data, and that's
what makes it defensible to have asked only two questions. Detail in `../data/gold/gold.md`.

## 2. What I measure

### Primary · Silent error — **rate and count**

```
silent_error_rate  = RESUELTA lines with ≥1 attribute different from the gold / total RESUELTA
silent_error_count = RESUELTA lines with ≥1 attribute different from the gold
```

This is the metric for the 3–8 week error. A wrong attribute on a resolved line is caught by
no one until the material arrives on site.

**Both are reported, and I found out why by measuring the critic.** A rate alone lies when a
component removes both good *and* bad lines from the resolved set: the critic removed 2 bad ones
and 4 good ones, the count dropped from 7 to 5 —two fewer expensive errors— and the rate rose from
50% to 62.5%. In other words, the rate was penalizing exactly the component that protects against
the most expensive error.

And the two things it removes aren't worth the same: 2 expensive errors avoided versus 4
unnecessary ~90-second reviews. Given the brief's asymmetry, that change is clearly good. A KPI
that can't see it isn't fit for deciding.

### Secondary · Useful autonomy

```
useful_autonomy = RESUELTA lines correct on all 7 attributes / total output lines
```
This is the metric that buys hours. It only goes up if the system both resolves *and* gets it
right: a system that sends everything to review scores 0 on it.

> **Joint-reading warning.** Silent error **is only interpreted together with split fidelity**.
> When the split fails, the lines don't align with the gold set and the harness compares fewer
> lines, so a model that can't split sets gets a favored silent-error figure. Below 100% split,
> the figure isn't reliable. This was discovered in the model sweep: three models with 0% silent
> error had splits of 40%, 60%, and 93%.

### Constraint · Set-explosion fidelity

```
split_fidelity = MTO rows with the correct number of output lines / MTO rows
```
Reported **separately** and never averaged with the rest: a failure here isn't one wrong
attribute, it's a material nobody buys.

### Tail noise

```
queue_noise = REVISION_MANUAL lines that the gold set considers correct / total REVISION_MANUAL
```
The metric for the "invisible failure": if this rises, the buyer stops looking at the queue, and
the protection against the expensive error is lost as well.

### Operational (required by the brief) — MEASURED

`npm run cost` (cache forced off: measuring against the cache would measure the cache).

**Rates**: developers.openai.com/api/docs/pricing, consulted 2026-08-22.
`gpt-5.5` 5.00 / 30.00 USD per million (input / output), input cache 0.50.
`gpt-5.4-mini` 0.75 / 4.50, cache 0.075. EUR/USD 1.1679 (ECB, 2026-08-21).

| | Measured over the 15 rows |
|---|---|
| Tokens per row | **1,730 input / 652 output** |
| Cost per row | **€0.024** ($0.0279) |
| Model time per row | **24.8 s** |

**Extrapolated to the brief's volumes** (4,000 fastener rows per revision, 25 revisions):

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
nothing, and the system prompt —which seemed like the expense— is irrelevant. The two real levers
are making the output more compact and choosing the model.

**The cheap model comes out 6.7× cheaper**: €259 per project versus €1,726. But that's not a
decision yet: it still needs to be measured how much accuracy is lost, and with the expensive
error costing between 3 and 8 weeks of project delay, €1,500 in savings per project doesn't buy
back a single failure. This gets measured on day 4 and enters the 2-pager as a comparison, not as
a hunch.

And the overall framing holds up against the real numbers: **inference cost is not the
constraint.** It's 2% of the manual baseline, and the difference between the expensive model and
the cheap one is €1,500 per project versus an €87,500 baseline. Cost isn't what needs optimizing;
accuracy is.
- **Per-attribute breakdown** of the four metrics above.

## 3. What I commit to

Available inputs: 20,000 rows/MTO, 15–25% fasteners, up to 25 revisions, 90 s/row, 6 people, cost
of the two errors.

| Magnitude | Calculation | Value |
|---|---|---|
| Fastener rows per MTO | 20,000 × 20% | 4,000 |
| Person-hours per full revision | 4,000 × 90 s | 100 h |
| Cost of a false resolved | 3–8 weeks on a work front + possible penalty | _pending_ |
| Gross savings if autonomy = X | | _pending_ |

**Proposed commitment:** _pending_ · **Argument:** _pending_

## 4. Where the threshold goes

Per-attribute confidence score (`exact_catalog=1`, `table_normalized`, `derived`, `inferred`,
`extrapolated`, `absent=0`) aggregated at the line level → threshold.

**Where I set it and why there:** _pending_. This is the case's business decision: the threshold
is chosen from the point where the expected cost of silent error equals the cost of tail noise,
not from an ROC curve.

## What this KPI deliberately discards

- **Plain accuracy.** The brief discards it: 100% correct with 90% sent to review is useless, and
  100% resolved with 85% correct is worse than nothing.
- **F1 over the two errors.** It would treat the two errors as equivalent when they differ by
  two orders of magnitude in cost.

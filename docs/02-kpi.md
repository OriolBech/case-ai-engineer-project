# KPI

> Status: 🚧 skeleton. Closed on day 1 and filled in with numbers on day 4.
> Feeds section 1 of the 2-pager. The brief requires answering four things: what you measure
> against, what you measure, what you commit to, and where the threshold sits.

## 1. What I measure against

| | |
|---|---|
| **Source** | Hand-labeled gold set over the 15 rows of the given MTO → ~40 lines × 7 attributes |
| **Method** | Double blind pass with a rest period between passes |
| **Measured self-consistency** | _pending_ % — this is the lower bound on the human error rate |
| **Cells marked CERTAIN** | _pending_ / _pending_ |
| **Cells marked POLICY-DEPENDENT** | _pending_ / _pending_ |
| **Robustness set** | 40–60 synthetic rows generated from the rules, not from the MTO. Not looked at until day 4. |

**Why I trust it, and how far.** _pending_

## 2. What I measure

### Primary · Silent error rate

```
silent_error_rate = RESUELTA lines with ≥1 attribute different from gold / total RESUELTA
```
This is the metric for the 3–8-week error. A wrong attribute on a resolved line isn't detected by
anyone until the material reaches the site.

### Secondary · Useful autonomy

```
useful_autonomy = RESUELTA lines correct on all 7 attributes / total output lines
```
This is the metric that buys hours. It only rises if the system resolves *and* gets it right: a
system that sends everything to review scores 0.

### Constraint · Set-split fidelity

```
split_fidelity = MTO rows with the correct number of output lines / MTO rows
```
Reported **separately** and never averaged with the rest: a failure here isn't a wrong attribute,
it's a material nobody buys.

### Queue noise

```
queue_noise = REVISION_MANUAL lines the gold considers correct / total REVISION_MANUAL
```
The "invisible failure" metric: if this rises, the buyer stops looking at the queue and the
protection against the costly error is also lost.

### Operational (required by the brief)

- **€/row processed** — with the multiplication done: `rows × reviews × €/row`.
  ⚠️ The current estimate (~€0.025/row) was made with Anthropic rates. **Recalculate** with
  OpenAI rates and token counts measured on day 2. See ADR-003.
- **Latency / 1,000 lines**.
- **Breakdown by attribute** for the four metrics above.

## 3. What I commit to

Available inputs: 20,000 rows/MTO, 15–25% fastener hardware, up to 25 revisions, 90 s/row,
6 people, cost of the two errors.

| Quantity | Calculation | Value |
|---|---|---|
| Fastener rows per MTO | 20,000 × 20% | 4,000 |
| Man-hours per full revision | 4,000 × 90 s | 100 h |
| Cost of a false resolve | 3–8 weeks on a front + possible penalty | _pending_ |
| Gross savings if autonomy = X | | _pending_ |

**Proposed commitment:** _pending_ · **Argument:** _pending_

## 4. Where the threshold sits

Confidence score per attribute (`exact_catalog=1`, `table_normalized`, `derived`, `inferred`,
`extrapolated`, `absent=0`) aggregated at line level → threshold.

**Where I put it and why there:** _pending_. This is the case's business decision: the threshold is
chosen from the point where the expected cost of a silent error equals the cost of queue noise, not
from an ROC curve.

## What this KPI deliberately discards

- **Plain accuracy.** The brief discards it: 100% correct with 90% sent to review is useless, and
  100% resolved with 85% correct is worse than nothing.
- **F1 over the two errors.** It would treat the two errors as equivalent when they differ by two
  orders of magnitude in cost.

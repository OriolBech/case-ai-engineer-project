# KPI

> Status: ✅. Feeds section 1 of the 2-pager. The brief requires answering four things: what you measure
> against, what you measure, what you commit to, and where the threshold sits. Second blind pass on the gold set: pending.

## 1. What I measure against

| | |
|---|---|
| **Source** | Hand-labeled gold set over the 15 rows of the given MTO → 30 lines × **8 cells** (7 attributes + quantity) |
| **Method** | Double blind pass with a rest period between passes |
| **Measured self-consistency** | _pending_ % — second blind pass without opening `gold.jsonl`. It's the lower bound on the human error rate, and without it the 100% above has nothing to compare against |
| **Cells marked CERTAIN** | **211** / 240 (88%) |
| **Cells marked POLICY-DEPENDENT** | **29** / 240 (12%) |
| **Robustness set** | 40–60 synthetic rows generated from the rules, not from the MTO. Not looked at until day 4. |

**Why I trust it, and how far.** 88% of the cells are deducible from `reglas_tornilleria.md`
or from the brief, and each one carries the rule that produced it. The remaining 12% depends on a
declared policy and is reported separately. The limits, stated before anyone else states them: the
second blind pass is missing, it hasn't been reviewed by a buyer with twenty years in the trade, and
it's only 30 lines — enough to steer development and catch regressions, not enough for a tight
confidence interval. That's why the commitment is argued from the cost of the two errors, not from
this percentage.

**What the gold set has already changed about the KPI.** 87% of the review queue is a single cause:
the MTO doesn't state the grade of a set's nuts and washers (`MISSING_IN_SOURCE`). No model fixes
that. So the primary metric can't be "% of lines resolved": it has to be
**% resolved out of what's resolvable**, plus the actionable list of what engineering needs to
fix. Promising 90% autonomy on this data is promising to invent.

**Sensitivity.** **No policy moves more than 3 lines out of 30.** The worst is P-4 (unitless
imperial length), which with `review` drops autonomy from 50% to 40%. That means the committed
number doesn't hang on a debatable decision but on the structure of the data, and it's what makes it
defensible to have asked only two questions. Details in `../data/gold/gold.md`.

## 2. What I measure

### Primary · Silent error — rate **and count**

```
silent_error_rate  = RESUELTA lines with ≥1 attribute different from gold / total RESUELTA
silent_error_count = RESUELTA lines with ≥1 attribute different from gold
```

This is the metric for the 3–8-week error. A wrong attribute on a resolved line isn't detected by
anyone until the material reaches the site.

**Both are reported, and I found the reason why by measuring the critic.** A rate alone lies when a
component removes both good *and* bad lines from the resolved set: the critic removed 2 bad ones and
4 good ones, the count dropped from 7 to 5 — two fewer costly errors — and the rate rose from 50% to
62.5%. In other words, the rate was penalizing exactly the component that protects against the most
expensive error.

And the two things it removes aren't worth the same: 2 avoided costly errors versus 4 unnecessary
~90-second reviews. Given the brief's asymmetry, that trade is clearly good. A KPI that can't see it
isn't useful for deciding.

### Secondary · Useful autonomy

```
useful_autonomy = RESUELTA lines correct on all 7 attributes / FAMILY output lines
```
This is the metric that buys hours. It only rises if the system resolves *and* gets it right: a
system that sends everything to review scores 0.

> **Joint-reading notice.** Silent error **is only meaningful read together with split fidelity**.
> When the split fails, the lines don't align with the gold and the harness compares fewer lines,
> so a model that doesn't know how to separate sets gets a favorably biased silent error. Below
> 100% split, the figure isn't reliable. This was discovered in the model sweep: three models with
> 0% silent error had 40%, 60%, and 93% split.

### Constraint · Set-split fidelity

```
split_fidelity = MTO rows with the correct number of output lines / MTO rows
```
Reported **separately** and never averaged with the rest: a failure here isn't a wrong
attribute, it's a material nobody buys.

### Queue noise

```
queue_noise = REVISION_MANUAL lines the gold considers correct / total FAMILY REVISION_MANUAL
```
The "invisible failure" metric: if this rises, the buyer stops looking at the queue and the
protection against the costly error is also lost.

### The denominator: what does NOT go in, and why (P-9)

The two rates above are calculated **over fastener-hardware lines**. A flange or a gasket that
the gold declares as another family is not in the denominator of either one.

This isn't an exclusion of convenience; it's that the two alternatives lie. Counting it as
unresolved penalizes the system for the one thing it can do right with it — refusing it — and makes
the number move with however many flanges the MTO happens to bring, which is not a property of the
system. Counting it as resolved would be the costly lie. It goes separately, in its own figure.

And **the exclusion is decided by the gold, never by the system**, because otherwise the system
could erase its own failures by calling a real bolt "another family." The two kinds of disagreement
are reported separately and don't cost the same:

| Disagreement | What it is | Cost |
|---|---|---|
| `missed` — the gold says another family, the system outputs lines | Seven invented attributes on a flange | The 3–8-week error. Also shows up as a silent error. |
| `falsePositives` — the system discards what the gold says is fastener hardware | A bolt nobody buys | A review, not a purchase. **Stays inside the denominator**: it's a coverage gap, not a foreign row. |

Implemented in `src/eval/harness.ts` (`outOfScope`) and visible in `pnpm run eval`.

### Operational (required by the brief) — MEASURED

`pnpm run cost` (cache forced off: measuring against the cache would measure the cache).

**Model delivered:** `openai/gpt-oss-120b` via OpenRouter. Tokens measured on the real MTO:
**1,730 input / 652 output per row** · **€0.000095/row**.

**Denominator: rows read, not fastener-hardware rows.** 20,000 × 25 = **500,000 reads per site**.
The figures with 4,000 × 25 = 100,000 and with prompt caching (€69/revision, €1,726/site on
`gpt-5.5`) predate correcting the denominator and choosing the model. Don't use them.

| | €/row | € per site (500,000 reads) | vs. €87,500 manual |
|---|---|---|---|
| `gpt-5.5` | 0.0175 | **8,750** | 10.0% |
| **`gpt-oss-120b` (delivered)** | **0.000095** | **48** | **0.05%** |

**Latency for 1,000 lines:** not promised. The 24.8 s/row from a single `gpt-5.5` pass was
invalidated (range 6.9–64.5; see §3-bis). The delivered model varies with OpenRouter routing (~50 to
~2,000 tok/s). Concurrency is a parameter of ours; the limit is the provider's rate limit.

### The two cost findings that change decisions

**96% of the cost at scale is OUTPUT tokens.** Direct consequence: caching more input barely buys
anything, and the system prompt — which looked like the expense — is irrelevant. The two real
levers are making the output more compact and choosing the model.

**The open model comes out 182× cheaper per site** (€48 versus €8,750) **while matching quality on
the gold.** With the costly error at 3–8 weeks, €8,700 saved per site doesn't buy back a single
failure. Cost isn't what needs optimizing; getting it right is.

## 3. What I commit to

Available inputs: 20,000 rows/MTO, 15–25% fastener hardware, up to 25 revisions, 90 s/row,
6 people, cost of the two errors.

| Quantity | Calculation | Value |
|---|---|---|
| Fastener rows per MTO | 20,000 × 20% | 4,000 |
| Rows **read** per revision | all 20,000: you have to read them to know which are fastener hardware | 20,000 |
| Man-hours per full revision | 4,000 × 90 s | **100 h** |
| Man-hours per site | 100 h × 25 revisions | **2,500 h** |
| Manual baseline per site | 2,500 h × €35/h loaded | **€87,500** |
| Cost of an unnecessary review | 90 s × €35/h | **€0.875** |
| Cost of a false resolve | 3–8 weeks stoppage on a front | see below |

### The number that decides the whole design is a ratio, not a cost

The brief doesn't put euros on the 3–8 weeks, and it doesn't need to: what decides the design is the
**ratio** between the two errors, and that can be bounded from below with what we're actually given.

An unnecessary review costs **€0.875**. A silent error stalls a work front for 3 to 8
weeks. Without knowing the crew size or the contractual penalty, the defensible floor for
"3 weeks of a stalled front" is on the order of **tens of thousands of euros**. Taking €20,000
as a conservative bound:

**Ratio ≈ 20,000 / 0.875 ≈ 23,000 to 1.**

That number, not a precision threshold, is what needs to sink in. It means
**it's worth sending twenty-three thousand lines to review to avoid a single silent error**. And
one whole full revision is 4,000 lines. In other words: at the real cost of the two errors,
**reviewing everything is cheaper than one silent error a year**.

From that, without further discussion, follows the shape of the commitment: you can't promise
*"silent error below 2%"*, because 2% over 4,000 lines is 80 costly errors per revision. At this
ratio, the only defensible figure is **zero**, and the only way to commit to zero isn't to get more
things right: it's to **not resolve what can't be justified**.

### The commitment

| # | Commitment | Measured today | How it's falsified |
|---|---|---|---|
| 1 | **Zero silent errors on certain cells.** No line comes out `RESUELTA` with a value the client's rules would decide differently | **0 errors across 15 resolved lines** · 211/211 certain cells · 0 hallucinations | `pnpm run eval` on any labeled MTO |
| 2 | **Every uncovered case comes out flagged, not resolved.** A value no table recognizes is a policy gap, not a silent default | 0 gaps on the given MTO (the policies were written against it) · 17 on the synthetic set, none false | `pnpm run gaps`, deterministic and over 100% of rows |
| 3 | **Every reviewable line can be fixed in ≤90 s**, from opening it to saving the decision | Inline flow built; **timed test pending** | Time representative corrections without opening Excel |
| 4 | **Every accepted suggestion stays in the shared vocabulary** and is reused without repeating the review | Material/finish are saved from the UI, fix the same cases in the open MTO, and remain active for subsequent ones | Repeat the same alias in the open MTO and in a later MTO |
| 5 | **Cost ≤ €0.0001 per row read**, i.e., **≤ €50 per site** of 500,000 reads | €0.000095/row → **€48/site** | `pnpm run cost` with `LLM_CACHE=off` |
| 6 | **Throughput, not latency.** See §3-bis | — | — |

**What commitment 1 doesn't say, and needs saying.** It's measured on 30 lines I labeled myself, and
the quantity cell went eighteen hours uncompared even though it's the only one where an error
*multiplies* the order (`05-results.md`). So the strong commitment isn't the figure, it's
**commitment 2**: the mechanism by which an unknown case comes to light instead of being resolved.
Commitment 1 is falsifiable with a blind set; commitment 2 is structural and can be audited by
reading the code.

**Autonomy stops being a commitment and becomes a snapshot.** Today it's 50%; tomorrow it will
depend on how many of the studio's conventions are already in the vocabulary. The product promise is
more useful: a decidable exception costs at most a 90-second review, stays saved, and shouldn't cost
those 90 seconds again on identical cases afterward. Any autonomy improvement that raises the silent
error rate is still a bad improvement.

## 3-bis. Latency: what isn't promised, and what's promised instead

The brief asks for *"latency to process a thousand rows."* The honest answer is that **that figure
can't be promised**, and the data proving it has been measured: `gpt-5.5` gave **6.9 · 44.0 · 64.5
s/row** across three identical runs. A factor of 9, from the provider, not us.

With concurrency 8, a thousand rows come out like this:

| | s/row | 1,000 rows |
|---|---|---|
| Best measured run | 6.9 | **~15 min** |
| Worst measured run | 64.5 | **~2.2 h** |

Giving the average (44 s → 1.5 h) would be the same methodological error this project already paid
for once: an argument was built on a single 24.8 s measurement and it didn't survive the second one.

**What IS promised**, because it depends on us and not on the provider:

- **It's a batch process, not an interactive one.** Nobody waits in front of the screen: the MTO
  goes in and the review queue appears. Per-row latency is not the business metric; **throughput**
  is.
- **It scales with concurrency**, which is a parameter of ours. The limit is the provider's rate
  limit, not the design.
- **A range with its own plan.** If the provider falls out of range, the `main` tier is repointed to
  another one via an environment variable, and `pnpm run providers:check` validates it before
  starting. Cost is stable (±5%) because tokens are nearly deterministic; latency is not stable at
  all.

## 4. Where the threshold sits

**The threshold isn't a number.** It's the **weakest admissible provenance** on a resolved line.

That's the decision, and the form matters as much as where it sits: a confidence scalar can't be
argued with a buyer, but a boundary expressed in provenances can. The flag is
`THRESHOLD_MIN_PROVENANCE` and it switches live.

### Where it sits, and why exactly there

The nine provenances, ordered, with the boundary inside:

| Provenance | What it means | Does it resolve? |
|---|---|---|
| `exact_catalog` | The value is written and is in a closed client catalog | yes |
| `table_normalized` | Alias recognized by a client table (`DIN 931` → `ISO 4014`) | yes |
| `extracted` | It's written literally; there's no catalog to corroborate it against (`M20`, `DIN 975`) | yes |
| `extracted_uncatalogued` | Marked as grade but outside the list (`GR B7`) — §5 says extract it as-is | yes |
| `extrapolated` | The measurement inherited within the set — **the only extrapolation the rules allow** (§2) | yes |
| `derived` | Material deduced from grade — **policy P-3, and the client answered it** | yes |
| `inferred` | Multiplicity or length unit assumed — **P-2 and P-4, both with a written rule** | yes ← **the threshold sits here** (`THRESHOLD_MIN_PROVENANCE=inferred`) |
| ↓ below the threshold ↓ | | |
| `absent` | Not in the MTO. Nothing a model can fix: goes back to engineering | **no**, never |
| `not_applicable` | Doesn't apply (length of a nut, §7). This is not an absence | not a gap |

**The argument, in one sentence:** the boundary separates **what has a written rule behind it**
from **what isn't there**. Everything admissible — including `inferred` — traces back to a value
from the row plus a closed client table, a question the client answered, or one of our
**declared, switchable policies with its volume measured** in `03-policies.md`. `absent` is the
only thing with nothing behind it, and it's never resolved.

**Why `inferred` falls inside and not outside.** It's the case a buyer would most likely challenge,
and the answer is the volume: it's **3 cells out of 240** (the imperial-length unit, P-4) plus the
unwritten multiplicities from P-2, which **don't block but do get flagged** and can be confirmed in
bulk on the front end. And what P-4's rule can't separate **isn't resolved wrong**: it falls to
review with `LENGTH_UNIT_IMPLAUSIBLE`. So `inferred` doesn't mean "the system guessed," it means "a
physical-range rule decided it, and what didn't fit the range is in your queue."

And at 23,000 to 1, this is what the threshold **cannot** be: a probability. **A probability
calibrated at 99% is still 40 costly errors per 4,000 lines**, and at this ratio that isn't
defensible. What is defensible is a rule a buyer can repeat out loud: *"the system resolves what's
written in the MTO, plus what your tables say it means, plus three rules you have in writing and can
switch off. What isn't there, you see."*

**Why `derived` falls on the good side.** It's the debatable case, because the material **isn't**
written in the row: it's deduced from the grade. It's above the threshold for a reason that isn't
technical — **it's policy P-3, and the client indirectly validated the criterion of deriving only
what is deterministic and unambiguous**. The provenance is recorded and the flag
`POLICY_MATERIAL_DERIVATION=off` moves it to the other side live. If the client changes their mind,
it's a configuration change, not a code change.

**Why `extrapolated` falls on the good side even though it's an extrapolation.** Because it's the
only one the client's rules explicitly authorize (§2, the measurement within a set), confirmed by
the client on 2026-08-22. It's not our judgment call: it's theirs.

### And it's falsifiable, which is what turns it into a decision instead of an opinion

Every move of the threshold has its measured delta, and it can be demonstrated live:

| Moving the threshold | Measured effect |
|---|---|
| `THRESHOLD_MIN_PROVENANCE=derived` (raise it one notch: `inferred` out) | Equivalent to the next two rows combined |
| `POLICY_UNITLESS_LENGTH=review` | Autonomy **50% → 40%**. Affects **3 of 240** cells |
| `POLICY_MATERIAL_DERIVATION=off` (raise it above `derived`) | Autonomy **→ ~0%**. Affects 14 of 15 rows |
| `POLICY_FINISH_SET_SCOPE=review` | 4 of 15 rows to review with `FINISH_SCOPE_UNSTATED` |

The second row is what shows why asking the client about material was worth it: without
that answer, the system has zero autonomy and the whole project buys nothing.

## What this KPI deliberately discards

- **Plain accuracy.** The brief discards it: 100% correct with 90% sent to review is useless, and
  100% resolved with 85% correct is worse than nothing.
- **F1 over the two errors.** It would treat the two errors as equivalent when they differ by
  two orders of magnitude in cost.

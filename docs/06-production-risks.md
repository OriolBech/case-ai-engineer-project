# What breaks this in production

> Status: ✅. Feeds section 6 of the 2-pager. Three risks, not seven: the ones that break this
> when it leaves the laptop and enters a procurement department. Each with **why I believe it**,
> **what detects it**, and **what I'd do**. A risk with no detector is just a nice sentence.

Of the five day-0 candidates, two drop out, and here's why: **cost** stopped being a risk once
measured (€121 per project vs. €87,500 baseline; see `02-kpi.md`), and the **dirty materials
master** is a real client problem but it's out of scope for this system — it shows up as line 7 of
`07-target-solution.md`, not as a pipeline failure mode. 2-pager §6.3 names it alongside two
buyers and the unmeasured human rate: they're criterion 4 of the case (*problems that aren't
technically yours*), not a failure mode of what I'm delivering.

The three that remain are ordered by **how much it costs when they happen**, not by probability.

---

## 1. The queue fills with noise and the buyer stops looking at it

**Why it's first.** The brief itself flags it as the invisible failure, and it's the only one of
the three that **destroys the system's value without producing a single measurable error**. The
metrics stay green, the buyer stops opening the queue, and from that point on the lines under
review get bulk-approved without a look. The system ends up worse than not having it, because now
the bad ones carry a machine's stamp.

**Why I think it's going to happen, with a number.** It's already happened twice on the laptop, in
miniature:

- An unrecognized quantity header produced **30 lines with the same reason**
  `QUANTITY_NOT_STATED`: a configuration problem disguised as thirty data problems. On a 4,000-row
  MTO that's four thousand lines in the queue over one cell's error.
- The critic, in its first version, put **31.8% noise** into the queue. Low recall wasn't the
  blocker; the noise was.

**What detects it.** `queue_noise` is one of the four first-class metrics, not an extra: reviews
that the gold considers already resolved. Today **0%**. And the KPI carries silent error in **both
rate and count** precisely because the rate alone rewards the component that dirties the queue.

**What I'd do, and what's already done.**

| | Status |
|---|---|
| Warn **once at the file level** when the problem is one of configuration, not of data, listing the candidate columns | done |
| **Typed** reasons so they can be grouped: 300 lines with the same reason get resolved in one action | done |
| Separate the channels: RFQ · engineering (`MISSING_IN_SOURCE`) · buyer (`LOW_CONFIDENCE`) · different family (`OUT_OF_SCOPE`, P-9) | done |
| The out-of-band channel: policy gaps go to a decision backlog, not to the buyer's queue | done |
| Separate, within that backlog, the policy gap from the **incomplete split**: they're different recipients and today both come out as `UNPLACED_EVIDENCE` | **pending**, and it's the first thing I'd fix |
| `queue_noise` with an alarm per review, not per project | pending |

---

## 2. Silent drift: the wrong supplier's vocabulary gets applied

**Why it's second and not first.** It costs more per error — it's the wrong purchase, 3–8 weeks on
a work front — but it's the best-covered one, and the one with the best story behind it.

**Why I think it's going to happen.** The client said it himself: *no two MTOs are alike*. The
current editable policies and vocabulary are global, but two suppliers or engineering firms can
reuse the same alias with different meanings. Applying to supplier B an entry learned from
supplier A doesn't look like a technical failure: it matches a table, passes confidence checks,
and can silently change the part being purchased.

Not every difference between suppliers is a conflict. It can be correct in both contexts if each
MTO is linked to its issuer and to a master version. The real conflict is having two incompatible
values alive **within the same scope**, or processing an MTO without knowing which scope to use.

Measured: **0 gaps** in the given MTO — as expected, the policies were written against it — and
**17 across 8 rows** in the synthetic set, which was built from coverage gaps and not from the
MTO. That's exactly the shape the first file from a new engineering firm will take.

**What detects it.** `pnpm run gaps`, deterministic, zero cost, over **100% of the rows** and not a
sample. It doesn't ask *"did the model get it right?"* but *"is there anything left unexplained
from the row in the output?"*, and that's why it catches things it wasn't designed for:

- On its **first run** it found a standards-parser bug nobody had seen: the Spanish conjunction
  *"y"* (and) was being swallowed as a suffix, producing `DIN 934 Y`. Invisible to 88 tests because
  the badly parsed standard still looked like a standard.
- It catches the **model's non-determinism**. Difficult multi-element rows split incorrectly
  ≈1 run out of 4 (measured with `pnpm run split:repeat`), and a run that collapsed an entire row
  into a single element came out flagged with four gaps instead of coming out as a three-element
  line.

**And the variant I didn't see coming: the defense that turns itself off.** The critic requested
2,048 output tokens against a reasoning model; on long rows it got truncated, the exception was
swallowed, and the row came out unreviewed with a `ran: false` indistinguishable from "wasn't
eligible." Three out of four eligible rows going unreviewed read like a rounding detail. **A
defense that silently stops working is worse than not having one**, because the number on the
dashboard doesn't move but confidence does. Fixed — budgeted at 8,192 and the failures counted,
named, and visible on the buyer's dashboard — but the lesson generalizes to any optional
component: *every `catch` that degrades has to leave a trace*. Detail in `03-policies.md` §P-10bis.

**What I'd do.**

| | Why |
|---|---|
| **Fail closed**: today the gap is reported *alongside* a line that's already been resolved by default. It should **block** | It's half the way there: the gap is visible, but the line has already gone out. "100% certain" is only structural if the gap blocks |
| **Mandatory supplier/issuer at MTO load time** and a fixed version at run time | Prevents a rerun from changing because the global master evolved, and avoids choosing by similarity |
| **Gap rate per supplier**, with its own curve and a minimum per cohort | The aggregate can't be allowed to let one easy supplier hide another one's drift |
| **Common base + per-supplier versioned vocabularies**, with who/when/why | Two legitimate meanings can coexist; a collision within the same scope blocks and requires a decision |
| Mandatory sampling of **resolved** lines for audit | It's the only place where silent error can hide indefinitely |

---

## 3. There's no ground truth to measure against, because two buyers don't normalize the same way within the same scope

**Why it's third, and why it's the most uncomfortable one.** It doesn't break the system: it
breaks the **ability to know whether the system works**. It's the least-discussed risk, and the
one that makes the other two undetectable.

**Why I think it's going to happen.** I wrote this case's gold set myself, and it already shows
both symptoms:

- The quantity cell went **labeled and uncompared** for eighteen hours, being the only one where an
  error *multiplies* the order. A blind spot of mine that no metric could see.
- I wrote the gold **and** the prompt. A shared error between the two isn't caught by this
  measurement, and I'm saying so before anyone else does.

In production this multiplies: six people normalizing, with no written rule for the cases
`reglas_tornilleria.md` doesn't cover, and a correction log that learns from decisions that
contradict each other. Two different answers for different suppliers can be two valid versions;
two different answers for the same supplier and version are an unresolved truth.

**What detects it.**

| | Status |
|---|---|
| **Second blind pass** of the gold, without opening `gold.jsonl` → lower bound on the human error rate. Without that number, the 100% has nothing to be compared against | **pending**, and it's the most important gap in the KPI |
| Explicit split between **certain / policy-dependent** per cell (211 / 29). A KPI that mixes the two partly measures my own opinion | done |
| The correction log records **who** made the correction | designed, not built |

**What I'd do.** Treat discrepancies between buyers not as model bugs but as **pending vocabulary
decisions within their scope**: same channel as the policy gaps, same format, same cadence. Two
buyers correcting the same cell for the same supplier in two different ways aren't a precision
problem — they're a rule the company never wrote down. If they belong to different suppliers,
they're kept as separate versions.

---

## What's deliberately NOT on this list

- **Cost.** It stopped being a risk once measured: €121 per project vs. €87,500 baseline. And the
  honest denominator (500,000 reads, not 100,000) is already in `05-results.md`, done before the
  CFO does it.
- **Latency.** It's not a risk, it's something that **isn't promised**: it varies by a factor of 9
  depending on the provider. Throughput is promised with a range and a plan (`02-kpi.md` §3-bis).
- **The model hallucinating.** 0 span hallucinations across 79 rows, and it's bounded by
  construction: a value whose evidence isn't in the row is discarded and counted. What's more
  concerning is the opposite, the **attribution** failure — a value that really is in the text, put
  in the wrong field — and that's handled by the critic and the gap detector.
- **Provider failure.** It's solved and measured: a row that fails comes out as `PROCESSING_FAILED`,
  never disappears, and `pnpm run eval` declares the measurement **invalid** out loud before giving
  any numbers.

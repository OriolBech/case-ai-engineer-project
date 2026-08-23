# What breaks this in production

> Status: ✅. Feeds section 6 of the 2-pager. Three risks, not seven: the ones that break this when
> it leaves the laptop and enters a purchasing department. Each one with **why I believe it**, **what
> detects it**, and **what I would do**. A risk with no detector is just a nice sentence.

Of the five candidates from day 0, two fall out and here's why: **cost** stopped being a risk once
measured (€48 per project versus €87,500 baseline; see `05-results.md`), and the **dirty material
master** is a real problem for the client but is out of scope for this system —
it shows up as line 2 of `07-target-solution.md`, not as a risk of what I'm delivering.

The three that remain are ordered by **how much it costs when they happen**, not by probability.

---

## 1. The queue fills with noise and the buyer stops looking at it

**Why it's first.** The brief itself flags this as the invisible failure, and it's the only one of
the three that **destroys the system's value without producing a single measurable error**. The
metrics stay green, the buyer stops opening the queue, and from that point on the lines sent to
review get approved in bulk without a look. The system becomes worse than not having it, because now
the bad ones carry a machine's stamp of approval.

**Why I think it will happen, with a number.** It's already happened to us twice on the laptop, in
miniature:

- An unrecognized quantity header produced **30 lines with the same reason**,
  `QUANTITY_NOT_STATED`: a configuration problem disguised as thirty data problems. On a 4,000-row
  MTO that's four thousand lines in the queue for a single cell's mistake.
- The critic, in its first version, put **31.8% noise** into the queue. Low recall wasn't the
  blocker; the noise was.

**What detects it.** `queue_noise` is one of the four first-class metrics, not an extra: reviews
that gold considers already resolved. Today **0%**. And the KPI carries the silent error in **rate
and count** precisely because the rate alone rewards the component that dirties the queue.

**What I would do, and what's already done.**

| | Status |
|---|---|
| Warn **once, at file level** when the problem is one of configuration, not of data, with the candidate columns | done |
| **Typed** reasons so lines can be grouped: 300 lines with the same reason get resolved in a single action | done |
| Split the channels: RFQ · engineering (`MISSING_IN_SOURCE`) · buyer (`LOW_CONFIDENCE`) · another family (`OUT_OF_SCOPE`, P-9) | done |
| The out-of-band channel: policy gaps go to a decision backlog, not the buyer's queue | done |
| Separate, within that backlog, the policy gap from the **incomplete split**: they're different recipients and today both come out as `UNPLACED_EVIDENCE` | **pending**, and it's the first thing I'd fix |
| `queue_noise` with an alarm per revision, not per project | pending |

---

## 2. Silent drift: another engineering study writes differently and nobody notices

**Why it's second and not first.** It costs more per error —it's the wrong purchase, 3–8 weeks of a
front stalled— but it's the one that's best covered, and the one with the best track record behind
it.

**Why I think it will happen.** The client said it themselves: *no two MTOs are alike*. And the
eleven policies P-1…P-11 were written **against the file we were given**. Each one has a default,
and **a default fires silently**. On the given MTO that works; on the first file of a new study it's
a costly error delivered with a machine's confidence.

Measured: **0 gaps** on the given MTO —as expected, the policies were written against it— and **17
across 8 rows** of the synthetic set, which was built from the coverage gaps and not from the MTO.
That's exactly the shape the first file of a new study will have.

**What detects it.** `pnpm run gaps`, deterministic, cost 0, over **100% of the rows**, not a
sample. It doesn't ask *"did the model get it right?"* but *"is there anything left in the row
unaccounted for in the output?"*, and that's why it catches things it wasn't designed for:

- On its **first run** it found a standards-parser bug nobody had seen: the Spanish conjunction
  *"y"* (and) got swallowed as a suffix, producing `DIN 934 Y`. Invisible to 88 tests because the
  mis-parsed standard still looked like a standard.
- It catches **model non-determinism**. Hard multi-element rows split incorrectly roughly 1 run in
  4 (measured with `pnpm run split:repeat`), and a run that collapsed an entire row into a single
  element came out flagged with four gaps instead of coming out as a three-element line.

**And the variant I didn't see coming: the defense that silently turns itself off.** The critic was
asking for 2,048 output tokens against a reasoning model; on long rows it was getting truncated, the
exception was swallowed, and the row came out unreviewed with a `ran: false` indistinguishable from
"wasn't eligible." Three of four eligible rows went unreviewed and it read like a rounding detail. **A
defense that stops working without saying so is worse than not having one**, because the number on
the dashboard doesn't move but confidence does. Fixed —budget raised to 8,192 and failures counted,
named, and made visible on the buyer's dashboard— but the lesson generalizes to any optional
component: *every `catch` that degrades has to leave a trace*. Detail in `03-policies.md` §P-10bis.

**What I would do.**

| | Why |
|---|---|
| **Fail closed**: today the gap is reported *alongside* a line that has already been resolved by default. It should **block** | It's halfway there: the gap is visible, but the line already went out. "Being 100% sure" is only structural if the gap blocks |
| **The gap rate as a product metric**, with its curve | Makes the promise falsifiable: a new study's first MTO has a high rate and it decays. You can say *"the system is learning your vocabulary, and here's the curve"* instead of just promising it |
| **Vocabulary as versioned data** (`vocabulary.json` with who/when/why) instead of tables in TypeScript | Changing a rule becomes an auditable data change instead of a deployment. The client can read a JSON; they can't read a `.ts` |
| Mandatory sampling of **resolved** lines for audit | It's the only place where the silent error can hide indefinitely |

---

## 3. There's no ground truth to measure against, because two buyers don't normalize the same way

**Why it's third, and why it's the most uncomfortable.** It doesn't break the system: it breaks the
**ability to know whether the system works**. It's the risk least talked about, and the one that
makes the other two undetectable.

**Why I think it will happen.** I wrote this case's gold set myself, and it already has both
symptoms:

- The quantity cell went **labeled and uncompared** for eighteen hours, despite being the only one
  where an error *multiplies* the order. A blind spot of mine that no metric was watching.
- I wrote both the gold **and** the prompt. An error shared between the two isn't caught by this
  measurement, and I'm saying so before anyone else does.

In production this multiplies: six people normalizing, no written rule for the cases
`reglas_tornilleria.md` doesn't cover, and a correction log that learns from decisions that
contradict each other.

**What detects it.**

| | Status |
|---|---|
| **Second blind pass** of gold, without opening `gold.jsonl` → a lower bound on the human error rate. Without that number, the 100% has nothing to compare against | **pending**, and it's the KPI's most important gap |
| Explicit split **certain / policy-dependent** per cell (211 / 29). A KPI that mixes the two is partly measuring my own opinion | done |
| The correction log records **who** made the correction | designed, not built |

**What I would do.** Treat disagreements between buyers not as model bugs but as **pending
vocabulary decisions**: same channel as the policy gaps, same format, same cadence. Two buyers
correcting the same cell in two different ways isn't a precision problem — it's a rule the house
never wrote down.

---

## What is deliberately NOT on this list

- **Cost.** It stopped being a risk once measured: €48 per project versus €87,500 baseline. And the
  honest denominator (500,000 reads, not 100,000) is already in `05-results.md`, done before the
  CFO does it.
- **Latency.** It isn't a risk, it's something that **isn't promised**: it varies by a factor of 9
  because of the provider. What's promised is throughput with a range and a plan (`02-kpi.md`
  §3-bis).
- **The model hallucinating.** 0 span hallucinations across 79 rows, and it's bounded by
  construction: a value whose evidence isn't in the row gets discarded and counted. What's more
  concerning is the opposite, the **attribution** failure — a value that really is in the text, put
  in the wrong field — and that's handled by the critic and the gap detector.
- **Provider failure.** It's solved and measured: a row that fails comes out as `PROCESSING_FAILED`,
  never disappears, and `pnpm run eval` loudly declares the measurement **invalid** before giving
  any figures.

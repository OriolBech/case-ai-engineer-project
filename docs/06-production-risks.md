# What breaks this in production

> Status: ✅. Feeds section 6 of the 2-pager. Three risks, not seven: the ones that break this when
> it leaves the laptop and enters a procurement department. Each with **why I believe it**, **what
> detects it**, and **what I'd do about it**. A risk with no detector is just a nice sentence.

Of the five candidates from day 0, two fall out and it's stated why: **cost** stopped being a risk
once measured (€48 per project versus a €87,500 baseline; see `05-results.md`), and the **dirty
materials master data** is a real client problem but out of scope for this system —
it appears as line 2 of `07-target-solution.md`, not as a risk of what I'm delivering.

The three that remain are ordered by **how much it costs when they happen**, not by probability.

---

## 1. The review queue fills with noise and the buyer stops looking at it

**Why it's first.** The brief itself calls it out as the invisible failure, and it's the only one
of the three that **destroys the system's value without producing a single measurable error**. The
metrics stay green, the buyer stops opening the queue, and from that point on the lines sent to
review get approved in bulk without being looked at. The system becomes worse than not having it,
because now the bad ones carry the stamp of a machine.

**Why I believe it will happen, with a number.** It already happened to us twice on the laptop, in
miniature:

- An unrecognized quantity header produced **30 lines with the same reason**,
  `QUANTITY_NOT_STATED`: a configuration problem disguised as thirty data problems. On a 4,000-row
  MTO that's four thousand lines in the queue for one cell's error.
- The critic, in its first version, put **31.8% noise** into the queue. Low recall wasn't the
  blocker; the noise was.

**What detects it.** `queue_noise` is one of the four first-class metrics, not an extra:
reviews that the gold considers already resolved. Today, **0%**. And the KPI carries silent error
in both **rate and count** precisely because the rate alone rewards the component that pollutes
the queue.

**What I'd do, and what's already done.**

| | Status |
|---|---|
| Warn **once, at the file level**, when the problem is one of configuration, not data, with candidate columns | done |
| **Typed** reasons so lines can be grouped: 300 lines with the same reason are resolved in one action | done |
| Separate the three channels: RFQ · engineering (`MISSING_IN_SOURCE`) · buyer (`LOW_CONFIDENCE`) | done |
| The **fourth** channel: policy gaps go to a decision backlog, not the buyer's queue | done |
| Separating, in that backlog, the policy gap from **incomplete splitting**: they're different recipients and both come out today as `UNPLACED_EVIDENCE` | **pending**, and it's the first thing I'd fix |
| `queue_noise` alarmed per review, not per project | pending |

---

## 2. Silent drift: another engineering firm writes differently and nobody notices

**Why it's second and not first.** It costs more per error — it's the wrong purchase, 3–8 weeks of
delay on a work front — but it's the best covered, and has the best story behind it.

**Why I believe it will happen.** The client said it himself: *no two MTOs are alike*. And the
nine policies P-1…P-9 were written **against the file we were given**. Each one has a default, and
**a default fires silently**. On the given MTO that works; on the first file from a new engineering
firm it's an expensive error delivered with the confidence of a machine.

Measured: **0 gaps** on the given MTO — as expected, the policies were written against it — and
**17 in 8 rows** of the synthetic set, which was built from coverage gaps rather than from the MTO.
That's exactly the shape the first file from a new firm will have.

**What detects it.** `npm run gaps`, deterministic, zero cost, over **100% of rows**, not a sample.
It doesn't ask *"did the model get it right?"* but *"is anything from the row left unexplained in
the output?"*, and that's why it catches things it wasn't designed for:

- On its **first run** it found a standards-parser bug nobody had seen: the Spanish conjunction
  *"y"* ("and") was being eaten as a suffix and produced `DIN 934 Y`. Invisible to 88 tests because
  the badly parsed standard still looked like a standard.
- It catches the **model's non-determinism**. Hard multi-element rows get split wrong ≈1 in 4 runs
  (measured with `npm run split:repeat`), and a run that collapsed an entire row into a single
  element came out flagged with four gaps instead of coming out as a three-element line.

**What I'd do.**

| | Why |
|---|---|
| **Fail closed**: today the gap is reported *alongside* a line already resolved by default. It should **block** | It's only halfway there: the gap is visible, but the line already went out. "Being 100% certain" is only structural if the gap blocks |
| **The gap rate as a product metric**, with its curve | Makes the promise falsifiable: the first MTO of a new firm has a high rate that decays. You can say *"the system is learning your vocabulary, and here's the curve"* instead of just promising it |
| **Vocabulary as versioned data** (`vocabulary.json` with who/when/why) instead of TypeScript tables | Changing a rule becomes an auditable data change instead of a deployment. The client can read a JSON; not a `.ts` file |
| Mandatory sampling of **resolved** lines for auditing | It's the only place where a silent error can hide indefinitely |

---

## 3. There's no ground truth to measure against, because two buyers don't normalize the same way

**Why it's third, and why it's the most uncomfortable.** It doesn't break the system: it breaks the
**ability to know whether the system works**. It's the risk talked about the least, and the one
that makes the other two undetectable.

**Why I believe it will happen.** I wrote this case's gold set myself, and it already shows both
symptoms:

- The quantity cell was **labeled and left uncompared** for eighteen hours, being the only one
  where an error *multiplies* the order. A blind spot of mine that no metric was watching.
- I wrote both the gold **and** the prompt. A shared error between the two isn't caught by this
  measurement, and I'm saying so before anyone else does.

In production this multiplies: six people normalizing, with no written rule for the cases
`reglas_tornilleria.md` doesn't cover, and a correction log learning from decisions that
contradict each other.

**What detects it.**

| | Status |
|---|---|
| **Second blind pass** of the gold, without opening `gold.jsonl` → a lower bound on the human error rate. Without that number, the 100% has nothing to compare against | **pending**, and it's the KPI's most important gap |
| Explicit **certain / policy** split per cell (211 / 29). A KPI that mixes the two partly measures my own opinion | done |
| The correction log records **who** made the correction | designed, not built |

**What I'd do.** Treat disagreements between buyers not as model bugs but as **pending vocabulary
decisions**: same channel as policy gaps, same format, same cadence. Two buyers correcting the
same cell two different ways aren't a precision problem — they're a rule the company never wrote
down.

---

## What is deliberately NOT on this list

- **Cost.** It stopped being a risk once measured: €48 per project versus a €87,500 baseline. And
  the honest denominator (500,000 reads, not 100,000) is already in `05-results.md`, done
  before the CFO does it.
- **Latency.** It's not a risk, it's something that's **not promised**: it varies by a factor of 9
  depending on the provider. Throughput is promised with a range and a plan (`02-kpi.md` §3-bis).
- **The model hallucinating.** 0 span hallucinations in 79 rows, and it's bounded by construction:
  a value whose evidence isn't in the row is discarded and counted. What's more concerning is the
  opposite, the **attribution** failure — a value that is in the text, placed in the wrong field —
  and that's handled by the critic and the gap detector.
- **Provider failure.** It's solved and measured: a row that fails comes out as
  `PROCESSING_FAILED`, never disappears, and `npm run eval` loudly declares the measurement
  **invalid** before giving any figures.

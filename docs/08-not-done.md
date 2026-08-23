# What I've decided not to do

> Status: ✅. Feeds section 5 of the 2-pager. *"A case without this section is a case where
> nothing has been decided."* Each entry: what, why not, what it would have cost, and what it
> would have bought.

| What | Why not | Cost avoided | What it would have bought |
|---|---|---|---|
| Fine-tuning or massive few-shot on the 15 rows | Judgment is measured against a blind set of 12 new rows: tuning against the given data is explicitly useless | ~2 h | Nothing, or an inflated KPI |
| LLM in normalization | These are 4 closed, exhaustive tables. It's the misjudgment the case penalizes | — | Nothing, and it costs money on top |
| Families other than bolted fasteners | The scope is deliberately small: they want depth | — | Surface area |
| Deployment / Docker / CI | The brief explicitly says deployment isn't needed | ~1 h | Nothing evaluable |
| Authentication and multi-user front end | The demo user is a single buyer | ~1.5 h | Nothing evaluable |
| Front-end UI for the vocabulary table (SQLite) | `src/rules/vocabulary-db.ts` is already queryable, extensible, and audited (`pnpm run vocab`), and that's enough for the case. A screen is front-end work with no new signal | ~2 h | Convenience, not capability |

## The ones that were hard to decide · added while measuring

The ones above were decided on day 0 and none of them hurt. These were decided with a measurement
in front of me, and they're the ones that teach something.

### Removing the critic

**It was on the verge of being cut.** The written stopping criterion was: harden the prompt →
if precision doesn't get past 70%, switch models → if that doesn't work either, remove it. With
29% recall and 33% precision, and **31.8% queue noise**, the decision seemed already made.

**Why it stays.** The noise wasn't coming from the model: it was given the **normalized** output
and asked to refute it against the **raw** text, with no way to tell the client's own tables apart
from an error. It flagged `DIN931` → `ISO 4014` as if it were an invention. Giving it the provenance
of each value, precision goes from **33% to 90%**.

**And what almost made it get dropped over a false reading**: every critic figure was from **a
single pass**. Three repetitions on the same input give recall of **14%, 43%, and 71%**. The
documented 29% was one sample, and a 0% I measured myself that same afternoon was another. On the
verge of removing a component that, in its best pass, eliminates 5 of 7 silent errors.

### Implementing the N-pass union for the critic

I have it measured — union of three: recall 71%, precision 83%, **€0.0045 per MTO** — and **I
haven't implemented it**. It's safe by construction, because the critic can only downgrade, so
every extra pass only adds catches.

**Why not**: the union figure is **arithmetic over three measured passes**, not an execution of
the function. Putting it in before delivery would mean shipping code whose number I haven't
actually measured, which is exactly the error this document already calls out three times. It goes
in as a line in `07-target-solution.md` with its cost.

### The deterministic filter before the model

A 5× on cost, measured at **0 false negatives and 0 false positives on 79 rows**, unimplemented.
It changes the semantics of P-9 — the out-of-family verdict would move from the model to a table in
80% of cases — and that's a product decision with its own measurement, not a last-minute patch.
The cost of not doing it is bounded and stated: €48 per project instead of ~€10.

### The third question to the client

There were three slots and I used **two**: derived material (P-3) and the scope of finish within a
set (P-1). Implicit multiplicity (P-2) was closed on my own, and the email says so — *"the one
that's missing, I'm not making it up."* The candidate for the third was the unit of imperial
lengths (P-4), and **I didn't spend it**: there's a defensible unilateral criterion — a physical
plausibility range applied across the board — and what the range doesn't separate **isn't
resolved incorrectly**, it falls to review under `LENGTH_UNIT_IMPLAUSIBLE`. Measured impact:
**3 cells out of 240**.

Asking something that's already decided, measured, and bounded spends a slot and signals that
you don't make decisions. The slot is saved for a real blocker.

### Repeating the 8-model sweep with all eight cells

The sweep in `11-benchmarks.md` §2 was measured over **seven** cells, before quantity was graded.
Repeating it costs ~€0.12 and I haven't done it: the conclusion it supports — price doesn't predict
quality — is decided by **split fidelity**, which doesn't depend on quantity. What I've done
instead is **flag the table** with what it's missing, rather than let it be read as if it were
on the same footing as the rest.

### Learning from the buyer's corrections (RL / feedback loop)

**The idea**: every line the buyer sends to review and corrects is, in practice, a
(input, gold) pair — the same format already used by `scripts/gold.py` and the fixtures in
`data/eval/critic-baseline-*.json`, just produced in production instead of by hand. With enough
accumulated corrections, the system could improve just from use.

**The project already has the template, and it's not RL: it's `src/rules/vocabulary-db.ts`.** The
material-derivation table (SQLite + append-only log in
`data/vocabulary/material-derivation.log.jsonl`) is exactly the pattern "a human decision extends a
queryable table, with who and when made it, without touching code or deploying" — `pnpm run vocab
add`. If the buyer's correction is captured, the natural place for it to land **isn't a
retrained model, it's one more row in a table like this one** (or a new one of the same kind for
other fields). Side note: today that table also has no front-end UI either, only a CLI — see the
row above in this document.

**Explicit constraint for any future design: it cannot add time to processing an MTO.** Capturing
the correction has to be a side effect **outside** the hot path (split → extract → validate →
critic): the correction is written when the buyer makes it in the UI, into another table/log, and
none of that is read or written during the processing of the *next* file except as a separate,
explicit step (like `pnpm run vocab`), never on the synchronous path that today takes "a few
seconds per row." Any proposal that involves querying a row-by-row history of corrections within
the processing pipeline is discarded for this reason alone, not only for what follows.

**Why this isn't part of this delivery**: there's no UI or storage today to capture the buyer's
correction as structured data (which field changed, from what value to what value), and without
that there's nothing to learn from. Building it is a new product piece, not a tweak to the current
pipeline.

**Why "RL" in the strict sense (retraining or adjusting model weights with a reward function) is
probably the wrong piece, even with the data already in hand**:

- It breaks the property that makes the critic safe. Its entire design (SPEC-006) is
  **asymmetric**: it can only downgrade, never promote, precisely because a component that can
  fail in both directions needs much more evidence to be safe. Learning from bidirectional human
  corrections — the buyer also promotes, not just downgrades — reintroduces that asymmetry
  through the back door.
- The buyer isn't pure gold. They correct in a hurry, and a wrong correction reinforced by RL
  becomes a silent bias in the system, exactly the error the critic exists to intercept.
- It clashes with the traceability requirement. SPEC-005 already rejects an LLM in the validator
  because "it would make the result non-reproducible." A model that changes with every correction
  has the same problem, worse: the trace of why a value came out would stop being stable across
  runs of the same file.
- It adds latency or infrastructure where the table doesn't: a model that gets retrained or that
  queries a reward model needs, at minimum, an offline training step; a row in SQLite is written
  and read in microseconds, as `vocabulary-db.ts` already demonstrates with twelve entries.

**What would actually be worthwhile, in order of cost/risk**, if this is picked up again:

1. **Deterministic tables first, following the `vocabulary-db.ts` pattern.** A correction on an
   equivalence (`DIN934→ISO4032` or similar) that the table didn't cover is a new row in the
   table, not a retraining run: near-zero cost, auditable, no risk of silent regression, and no
   touching the pipeline's hot path. Consistent with SPEC-004's policy of not putting a model
   where a table suffices.
2. **Few-shot / retrieval of corrected examples** in the split-extract and critic prompts:
   reversible, auditable line by line, doesn't touch weights — but it does add one more query
   before calling the model, so it conflicts with the constraint of not adding time unless it's
   cached the same way as the rest of the calls.
3. **Fine-tuning or RL on the model**: the last resort, not the first, and only with enough
   volume and a review process for the corrections before using them as a signal. It's also the
   only one of the three that can't be done without a latency cost or a separate training
   pipeline.

**What it would have cost to do this now**: a structured-correction capture layer in the UI,
persistent storage per file/line (extending the `vocabulary-db.ts` pattern instead of inventing a
new one), and a process (manual, at least at first) to decide which corrections get promoted to a
table and which don't. None of the three exist today; the pipeline as designed is meant to be
reproducible given an input file, not to change between runs.

**What it would have bought**: continuous improvement with use, especially on the first MTOs of
each new client, which is exactly when the system's confidence (calibrated on the test files, not
on the client's own) is least reliable — see `docs/12-system-behind-the-rules.md` and the
"confidence vs. verified accuracy" notice in the UI (`app/components/KpiPanel.tsx`).

### A complete "no-LLM" mode

The deterministic baseline exists (`findNames`, `findStandards`, `findFinishes`) and is used for
routing, for detecting gaps, and for deciding the name, the designation length, and the
multiplicity. **I haven't finished it as a complete execution mode.**

Why: without a model there's no set segmentation, and 47% of the rows in the given MTO describe
more than one material. A no-LLM mode would give 15 lines where there should be 30. As an
*ablation* to demonstrate what the model buys, it's valid; as a production mode, it isn't.

# What I've decided not to do

> Status: ✅. Feeds section 5 of the 2-pager. *"A case without this section is a case where nothing
> was decided."* Each entry: what, why not, what it would have cost, and what it would have bought.

| What | Why not | Cost avoided | What it would have bought |
|---|---|---|---|
| Fine-tuning or massive few-shot on the 15 rows | Judgment is tested against a blind set of 12 new rows: tuning against the given data is explicitly useless | ~2 h | Nothing, or an inflated KPI |
| LLM in normalization | These are 4 closed, exhaustive tables. It's exactly the judgment error the case penalizes | — | Nothing, and it costs money on top |
| Other families besides fasteners | The scope is deliberately small: they want depth | — | Surface area |
| Deployment / Docker / CI | The brief explicitly says deployment isn't needed | ~1 h | Nothing evaluable |
| Authentication and multi-user in the front end | The demo's user is a single buyer | ~1.5 h | Nothing evaluable |

## The ones that were hard to decide · added while measuring

The ones above were decided on day 0 and none of them hurt. These were decided with a measurement
in hand, and they're the ones that teach something.

### Removing the critic

**It came close to being cut.** The written stopping criterion was: tighten the prompt → if
precision doesn't get above 70%, switch models → if that doesn't work either, remove it. With 29%
recall and 33% precision, and **31.8% queue noise**, the decision seemed made.

**Why it stays.** The noise wasn't coming from the model: it was given the **normalized** output
and asked to refute it against the **raw** text, with no way to tell the client's own tables apart
from an error. It flagged `DIN931` → `ISO 4014` as if it were an invention. Given the provenance of
each value, precision goes from **33% to 90%**.

**And what nearly made it leave with a false claim**: every critic figure was from **a single
pass**. Three repetitions on the same input give recall of **14%, 43%, and 71%**. The documented
29% was one sample, and a 0% I measured myself that same afternoon was too. It came close to
removing a component that, on its best pass, eliminates 5 of 7 silent errors.

### Implementing the union of N critic passes

I have it measured —union of three: recall 71%, precision 83%, **$0.0045 per MTO**— and **I
haven't implemented it**. It's safe by construction, because the critic can only downgrade, so
every extra pass only adds catches.

**Why not**: the union figure is **arithmetic over three measured passes**, not a run of the
function. Adding it before delivery would mean shipping code whose number I haven't actually
measured, which is exactly the error this document already records three times. It goes as a line
in `07-target-solution.md` with its cost.

### The deterministic filter before the model

A 5× cost reduction, measured at **0 false negatives and 0 false positives on 79 rows**, not
implemented. It changes the semantics of P-9 —the out-of-family verdict would move from the model
to a table in 80% of cases— and that's a product decision with its own measurement, not a
last-minute patch. The cost of not doing it is bounded and stated: 121 € per site instead of ~25 €.

### The third question to the client

There were three slots and I used **two**: the derived material (P-3) and the scope of the finish
in a set (P-1). The implicit multiplicity (P-2) was closed on my own, and the email says so —
*"the one that's missing, I don't make it up."* The candidate for the third was the unit for
imperial lengths (P-4), and **I didn't spend it**: there's a defensible unilateral criterion —a
physical plausibility range applied outright— and what the range doesn't separate out **doesn't
get resolved wrong**, it falls to review with `LENGTH_UNIT_IMPLAUSIBLE`. Measured impact: **3 cells
out of 240**.

Asking something that's already decided, measured, and bounded spends a slot and signals a failure
to decide. The slot is kept for a real blocker.

### Repeating the 8-model sweep with the eight cells

The sweep in `10-benchmarks.md` §2 was measured over **seven** cells, before quantity was graded.
Repeating it costs ~0.12 € and I haven't done it: the conclusion it supports —price doesn't
predict quality— is decided by **split fidelity**, which doesn't depend on quantity. What I've
done is **flag the table** with what's missing from it, instead of letting it be read as if it
were on the same basis as the rest.

### Learning from buyer corrections (RL / feedback loop)

**The idea**: every line the buyer sends to review and corrects is, in practice, an (input, gold)
pair — the same format already used by `scripts/gold.py` and the fixtures in
`data/eval/critic-baseline-*.json`, just produced in production instead of by hand. With enough
accumulated corrections, the system could improve just from being used.

**The project already has the template for this, and it isn't RL: it's the vocabulary as data.**
Material (`vocabulary-db.ts`) and finish (`finish-db.ts`, SPEC-011) are SQLite plus an append-only
log in git, with who/when/why, extensible without a deployment. The buyer edits them in **a single
view** (`/vocabulario`, SPEC-012). An accepted suggestion in the queue rewrites the lines of the
open MTO and leaves them to be validated (SPEC-013); the KPI for those suggestions is measured
**separately** from the pipeline (`pnpm run suggestions:kpi`). What this section still doesn't do
is RL: no model is retrained on the corrections.

**Explicit constraint for any future design: it can't add time to processing an MTO.** Capturing
the correction has to be a side effect **outside** the hot path (split → extract → validate →
critic): the correction is written when the buyer makes it in the UI, into another table/log, and
none of it is read or written while processing the *next* file except as a separate, explicit step
(something like `pnpm run vocab`), never in the synchronous path that today takes "a few seconds per
row." Any proposal that involves consulting a row-by-row correction history inside the processing
pipeline is ruled out for this reason alone, not just for what follows.

**Why RL (and auto-promotion with no human) doesn't make it into this delivery**: the capture
already exists (vocabulary + corrections in `human_corrections` + suggestions module). What doesn't
make it in is learning model weights or promoting a system prediction without a sign-off. The front
end still applies suggestions within the session and doesn't write them to the history: the hook is
in SPEC-013, it isn't RL.

**Why "RL" in the strict sense (retraining or fine-tuning model weights with a reward function) is
probably the wrong piece, even with the data already in hand**:

- It breaks the property that makes the critic safe. Its entire design (SPEC-006) is
  **asymmetric**: it can only downgrade, never promote, precisely because a component that can fail
  in both directions needs much more evidence to be safe. Learning from bidirectional human
  corrections — the buyer also promotes, not just downgrades — reintroduces that asymmetry through
  the back door.
- The buyer isn't pure gold. They correct in a hurry, and a wrong correction reinforced by RL
  becomes a silent bias in the system, exactly the error the critic exists to catch.
- It clashes with the traceability requirement. SPEC-005 already rejects an LLM in the validator
  because "it would make the result non-reproducible." A model that changes with every correction
  has the same problem, worse: the trace of why a value came out would stop being stable across
  runs of the same file.
- It adds latency or infrastructure where a table doesn't: a model that gets retrained or that
  queries a reward model needs, at minimum, an offline training step; a row in SQLite is written
  and read in microseconds, as `vocabulary-db.ts` already shows with twelve entries.

**What would actually be worth doing, in order of cost/risk**, if this is picked back up:

1. **Deterministic tables first, following the `vocabulary-db.ts` pattern.** A correction on an
   equivalence (`DIN934→ISO4032` or similar) that the table didn't cover is a new row in the table,
   not a retraining run: near-zero cost, auditable, no risk of silent regression, and it doesn't
   touch the pipeline's hot path. Consistent with SPEC-004's policy of not putting a model where a
   table is enough.
2. **Few-shot / retrieval of corrected examples** in the split-extract and critic prompts:
   reversible, auditable line by line, doesn't touch weights — but it does add one more lookup
   before calling the model, so it conflicts with the no-added-time constraint unless it's cached
   the same way as the rest of the calls.
3. **Fine-tuning or RL on the model**: the last resort, not the first, and only with enough volume
   and a review process for the corrections before using them as a signal. It's also the only one
   of the three that can't be done without either latency cost or a separate training pipeline.

**What exists now, and what's still out of scope.** The contract is in
`specs/SPEC-015-corrections-learning.md`. `proposeCorrection` requires a reason and literal
evidence; two different values on the same span stay PENDING and come out as `ValueConflict`
(`listValueConflicts`). `classifyPromotion` doesn't generate an alias if there's a conflict. The
queue writes corrections (`POST /api/corrections`) when applying a vocabulary patch; `/vocabulario`
lists the pending decisions. `pnpm corrections:kpi` and `orchestratePromotion` exist: promoting
finish/material requires an explicit `regressionPassed`, it doesn't run eval on its own. There's no
login. What's still out of scope: picking a value in the UI and promoting it; wiring up the gold
for measure/quantity. The pipeline doesn't read `human_corrections` on the hot path.

**What it would have bought**: continuous improvement with use, especially on the first MTOs of
each new client, which is exactly when the system's confidence (calibrated on the test files, not
on theirs) is least reliable — see `docs/11-system-behind-the-rules.md` and the "confidence
vs. verified accuracy" warning in the UI (`app/components/KpiPanel.tsx`).

### A complete "no-LLM" mode

The deterministic baseline exists (`findNames`, `findStandards`, `findFinishes`) and is used for
routing, for gap detection, and for deciding the name, the designation length, and the
multiplicity. **I haven't closed it off as a complete execution mode.**

Why: without a model there's no set segmentation, and **9 of 15** rows in the given MTO describe
more than one material. A no-LLM mode would give 15 lines where there are 30. As an *ablation* to
demonstrate what the model buys, it's worthwhile; as a production mode, no.

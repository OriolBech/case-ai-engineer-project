# Benchmarks

All of the project's measurements, with their method, date, and limitations. This is the document
section 3 of the 2-pager comes from, and the one used to answer the session's questions.

**Total spend on measurement to date: €0.38.** Measuring isn't what's expensive.

| Date | What was measured | Cost |
|---|---|---|
| 2026-08-22 | 8 models × 15 rows, twice (before and after the name fix) | €0.12 |
| 2026-08-22 | `kimi-k3` | €0.25 |
| 2026-08-22 | Critic, two experiments | €0.002 |
| 2026-08-22 | Cost and latency with cold cache, 3 repetitions | €0.01 |
| 2026-08-22 | 10 file-format variants | €0 (deterministic) |
| 2026-08-22 | Gold re-measurement with the 8 cells, synthetic set with the new prompt | €0.01 |
| 2026-08-22 | Critic over the frozen fixture, 3 repetitions with no cache | €0.004 |
| 2026-08-22 | Split of 4 rows × 3 repetitions with no cache (`split:repeat`) | €0.004 |

---

## 1. Method

**Against what.** `data/gold/gold.jsonl`: 15 rows → 30 lines, hand-labeled **before** the pipeline
existed. **Eight cells per line**: the seven attributes and the quantity. Each marked `C`
(deducible from the client's rules) or `P` (dependent on a declared policy). **Metrics are computed
over the `C` cells** — **211 of 240** — the `P` ones are reported as sensitivity. A KPI that mixes
both partly measures our own opinion.

Quantity was added to the harness on 2026-08-22, after discovering it **was labeled but not being
compared**. See §3-bis: every figure before that date is blind to the one cell where an error
multiplies the order.

**What's measured.** Exact definitions in `02-kpi.md`:

- **Silent error** (primary), in **rate and count**. `RESOLVED` lines with ≥1 certain cell wrong.
- **Useful autonomy**: resolved *and* correct, over the total.
- **Split fidelity**: rows with the correct number of lines. **Reported separately, never
  averaged in**: breaking a set isn't a wrong attribute, it's material nobody buys.
- **Queue noise**: reviews the gold set marks as already resolved.
- €/row cost, latency, per-attribute breakdown.

**Joint-reading rule.** Silent error **only makes sense read alongside split fidelity**. See §6.

**Reproduce**: `pnpm run eval`, `pnpm run sweep`, `pnpm run cost`, `pnpm run variants`,
`pnpm run providers:check`.

---

## 2. Model comparison · final state

8 models × 15 rows, critic turned off (this measures the extractor).

> **Read with §3-bis in front of you.** This table was measured over **seven** cells: quantity
> wasn't being compared. It doesn't invalidate the conclusion — the ranking is decided by split
> fidelity, which doesn't depend on quantity — but the silent-error and autonomy columns are
> measured over 190 cells, not 211. Re-running the full sweep with all eight cells costs ~€0.12
> and is listed in §8.

| Model | $/M output | Silent err. | Autonomy | Split | Noise | Halluc. |
|---|---|---|---|---|---|---|
| `gpt-5.5` (reference) | 30.00 | **0%** | **50.0%** | **100%** | **0%** | 0 |
| `moonshotai/kimi-k3` | 15.00 | **0%** | **50.0%** | **100%** | **0%** | 0 |
| **`openai/gpt-oss-120b`** | **0.17** | **0%** | **50.0%** | **100%** | **0%** | 0 |
| `qwen/qwen3-235b-a22b-2507` | 0.55 | **0%** | **50.0%** | **100%** | 0% | 0 |
| `deepseek/deepseek-v3.2` | 0.40 | 0% | 46.7% | 100% | 6.3% | 0 |
| `z-ai/glm-5.2` | 3.04 | 14.3% | 40.0% | 87% | 0% | 0 |
| `deepseek/deepseek-v4-pro-0813` | 3.56 | 0%* | 26.7% | 67% | 12.5% | 0 |
| `qwen/qwen3.8-max` | 6.00 | 0%* | 3.3% | 47% | 62.5% | 0 |

`*` figure not reliable: see §6.

**Per-attribute breakdown (certain cells)**

| Model | name | material | quality | measure | length | standard | finish |
|---|---|---|---|---|---|---|---|
| `gpt-5.5` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `kimi-k3` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `gpt-oss-120b` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `deepseek-v3.2` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `qwen3-235b` | 100% | 92% | 97% | 100% | 100% | 100% | 100% |
| `glm-5.2` | 100% | 100% | 92% | 100% | 100% | 100% | 100% |
| `deepseek-v4-pro` | 88% | 100% | 88% | 88% | 86% | 88% | 85% |
| `qwen3.8-max` | 44% | 50% | 56% | 44% | 43% | 44% | 67% |

### Conclusions

**Price doesn't predict quality.** Ordered by output rate, split fidelity goes
100% → 100% → 47% → 67% → 87% → 100% → 100% → **100%**. The **cheapest** open model of the eight
matches the reference, and the $6/M one is the worst. Picking a model by rate would have been
picking wrong in both directions.

**`qwen3.8-max` is the degenerate case the brief warns about**: 3.3% autonomy and 62.5% noise.
It's *"a system that gets 100% right by sending 90% of the rows to review."* Ranked by silent
error alone it comes out **first**; all four metrics are needed for it to end up last. This
validates the KPI.

---

## 3. The main finding: who decides the name

Before the fix, with the cache intact (the change is deterministic and happens **after** the model
call, so the comparison is over the **same responses**):

| Model | Silent err. | Autonomy |
|---|---|---|
| `gpt-oss-120b` | 13% → **0%** | 43% → **50%** |
| `qwen3-235b` | 21% → **0%** | 37% → **50%** |

`gpt-oss-120b` failed **two cells in the entire MTO**: `STUD BOLT` classified as
`VARILLA ROSCADA` in rows 1 and 12. Verified that it was returning the **correct** literal term
(`detectedName: "STUD BOLT"`) and only failed at **classifying** it.

The fix wasn't switching models or touching the prompt: it was **deciding who's in charge**. The
model reports *what text it saw*; the table from §3 decides *what it means*, because it's a closed
five-value catalog that `findAliases` resolves at 100% with the longest-alias-first rule
(`STUD BOLT` beats `BOLT`).

Put in money terms: getting the boundary between model and table right is worth **13 points of
silent error** and moves the defensible cost from **€1,749 to €9 per project**. It's the evaluation
criterion *"whether you know when an agent isn't needed"* with a number behind it.

---

## 3-bis. The eighth cell: the harness wasn't looking at quantity · 2026-08-22

**The finding that invalidates every measurement in this document up to this point**, and the
most expensive method error of the session. It's said first because it changes how §2 and §5 have
to be read.

`gold.jsonl` has labeled **eight** cells per line from day one: the seven attributes and the
**quantity**, with its own certain/policy split (21 certain, 9 policy). `evaluate()` was comparing
seven. The cell loop iterated over `ATTRIBUTE_KEYS`, and quantity isn't in that list.

Consequence: a line asking for **10,000 bolts where the MTO asks for 100** came out with a perfect
breakdown. And it's not hypothetical — it was the real state of two `gpt-5.4-mini` lines.

### How it surfaced

It wasn't found by a test or a code review. It was found by **the critic**, and that's why this
section is also the best defense that component has.

In the §5 experiment the critic downgraded lines `4.1` and `7.1`, and both were counted as
**false positives** because no metric saw anything wrong with them. Both were right: the model had
carried the number from the **quantity column** into the **multiplicity** field, and the pipeline
obediently multiplied. 100 sets → 10,000 bolts. 50 → 2,500.

In other words: the critic's precision was underestimated because it was being measured against a
blind harness. A safety component judged by a judge who isn't looking where it looks.

### What got fixed, in three layers

| Layer | What |
|---|---|
| The judge | Quantity is the eighth gradable cell. It's not part of the attribute breakdown — it's not from the catalog — but it **does** count toward silent error: it's the only field where getting it wrong *multiplies* the order |
| The policy | P-2 has said "multiplicity is 1 if not written" since day one, and the code applied the model's number without checking. That was the real path to the 10,000 |
| The rule | Multiplicity is **decided by the row**, with a regex over the text. Contract and pattern table in `specs/SPEC-002-set-splitter.md` |

**Certain-cell denominator: 190/210 → 211/240.** Any figure in this document dated before this
section is blind to quantity.

### State of the gold set with the eight cells · `gpt-oss-120b`

First measurement in the project that scores all eight and gets every one right.

| | Value |
|---|---|
| Lines | 30 / 30 |
| Split fidelity | **100%** (15/15 rows) |
| **Silent error** | **0%** |
| Useful autonomy | 50.0% |
| Queue noise | 0% |
| The 7 attributes | 100% certain |
| **Quantity** | **21/21 certain · 9/9 policy** |
| Rejected multiplicities | 0 |

The 0 rejected multiplicities is the honest signal: in this file the row and the model agree on
every one. The guard isn't papering over a disagreement, it's confirming there isn't one.

### The same boundary, three times

That makes **three** decisions moved from the model to a table, and all three closed a real error:

| Decision | Before | Now | What it was worth |
|---|---|---|---|
| The **name** | model classification | `findNames` over the literal term | 13 points of silent error (§3) |
| The **length** inside `M16x60` | a second JSON field | regex over the ISO designation | 1 resolvable line per row with the length in the designation |
| The **multiplicity** | model's number | regex over the row, anchored to the name | 2 lines with the order multiplied by the set size |

It's not the same coincidence three times. It's the same criterion: **where a closed rule can
decide, the model doesn't get a vote.** And it's the numbered answer to the criterion
*"whether you know when an agent isn't needed."*

### The same method error, again

Worth stating because it's the same one as §5-bis wearing a different face. The first multiplicity
fix asked the **model** for the evidence and verified it. An hour later, the critic's frozen
fixture — recorded **before** that field existed — failed the check on all of its multiplicities
and turned 80 nuts into 40. The critic flagged those lines, correctly, and they looked like model
extraction errors.

A guard that turns missing metadata into a wrong number is worse than the gap it was closing. And
the measurement used to judge the critic was contaminated by my own fix. **Every measurement of a
component is taken over a pipeline in some state, and that state is part of the measurement.**

And a third one, same day: the regex ended up anchored to the **start of the element's evidence**
instead of to the **name**. The model returns `W/2 HEX. NUT 7/8"` as evidence, so the `2` falls
*inside* the span and went unnoticed: the **five** real multiplicities in the MTO were rejected and
silent error rose to 13.3%. No unit test caught it, because every one of them built the evidence
starting cleanly at the name — **the test and the code shared a premise neither had checked
against a real response.** The gold set caught it.

---

## 4. Cost and latency

Tokens measured over the real MTO: **1,730 input / 652 output per row**.

| Configuration | €/row | € per project (4,000 rows × 25 rev.) | vs manual |
|---|---|---|---|
| Manual (90 s/row, €35/h) | 0.875 | 87,500 | — |
| `gpt-5.5` | 0.0175 | 1,749 | 2.0% |
| `kimi-k3` | 0.0169 | ~1,240 | 1.4% |
| **`gpt-oss-120b`** | **0.000095** | **9** | **0.01%** |

**96% of cost at scale is output tokens.** Caching more input buys almost nothing; the levers are
output verbosity and model choice.

### Latency can't be promised

`gpt-5.5`, three identical repetitions: **6.9 · 44.0 · 64.5 s/row**. A factor of 9.

This invalidated an argument I had built myself on a single 24.8 s measurement. **Cost is stable
(±5%) because tokens are nearly deterministic; latency isn't stable at all.**

Consequence for the commitment: don't promise a latency whose variance belongs to the provider.
Promise throughput with margin, and a plan for when it goes out of range. Every "minutes for 1,000
lines" figure comes with its range.

### The variance wasn't the model's — it was the routing's · 2026-08-22

The previous section said "the variance is the provider's and I don't control it." It turned out
to be more specific: it's about **which OpenRouter provider serves the model on each call**. The
same `gpt-oss-120b` runs at ~50 tok/s on one provider and ~2,000 on another. Pinning the routing
(`OPENROUTER_PROVIDER_SORT=throughput`) and lowering the reasoning effort
(`LLM_REASONING_EFFORT` — the bulk of gpt-oss's clock is thinking tokens) was measured against the
baseline, same input, cache off:

| Configuration | s/row model | Silent err. | Autonomy | Noise | Certain cells |
|---|---|---|---|---|---|
| Random routing, default effort | **77.3** | 0% | 50.0% | 0% | 211/211 |
| throughput + `low` | 2.8 | 0% | 46.7% | 6.3% | 209/211 |
| **throughput + `medium`** | **3.7** | **0%** | **46.7%** | **6.3%** | **211/211** |

**21× faster with quality intact.** `low` was discarded over its two `material` cells
(`ASTM F436`, a standard, in the material field — the same failure mode `gpt-5.4-mini` had back in
its day). `medium` recovers all of them.

The visible cost: one critic false positive (downgrades a line the gold set counts as resolved),
which moves autonomy from 50.0% to 46.7% — **above the commitment (≥45%)** — and queue noise from
0% to 6.3%. A single pass doesn't tell you whether that false positive is from the effort setting
or from randomness: the critic itself gave recalls of 14%, 43%, and 71% across three identical
passes (§5). Pending: repeat, and if confirmed, the `critic` tier's effort gets decoupled from the
rest — today `LLM_REASONING_EFFORT` is global.

Two invariants were needed for this measurement to be honest:

1. **Provider options go into the cache key** (`cacheKeyExtra`). Without that, turning on routing
   would have served cached responses saved under the old routing, and the comparison would
   measure the cache, not the change.
2. **The baseline was measured with `LLM_CACHE=off`.** With cache on, "no options" would have given
   0 s/row and the 21× would be infinite, which is another form of lying.

What does NOT change: the promise is still throughput, not per-row latency. A pass at 3.7 s isn't a
property; it's evidence that the large variance was routing. The strong claim — "with routing
pinned, variance drops from 9× to ~1.5×" — needs its own three repetitions. In `scripts/bench.ts`
it's a `CONCURRENCY=8 pnpm run bench` away.

---

## 5. The critic

`openai/gpt-oss-120b`, routed by decomposition risk (9 of 15 rows).

**Experiment A — over a pipeline with 0% silent error:**

| | Without critic | With critic |
|---|---|---|
| Silent error | 0% | 0% |
| Autonomy | 50.0% | **26.7%** |
| Queue noise | 0% | **31.8%** |

Downgraded 7 of 8 correct lines. And a domain error: it flagged "missing material=ZN", when `ZN`
is a **finish**, not a material.

**Experiment B — over `gpt-5.4-mini`'s output, with 7 known real errors:**

| | Lines | |
|---|---|---|
| Hits | `1.3`, `5.3` | 2 |
| False positives | `2.1`, `7.1`, `7.2`, `9.1` | 4 |
| Missed | `1.1`, `1.2`, `5.1`, `5.2`, `12.1` | 5 |

**Recall 29% · Precision 33%.**

**The concept works; the implementation doesn't get there.** The two hits are exactly what only
this component can catch: the washer with no quality that `mini` put a **standard**
(`ASTM F436`) into for the quality field. The span verifier doesn't catch it because the value
really is in the text: the failure is one of **attribution**, not invention.

The blocker isn't the low recall, it's the **31.8% noise**: the brief warns that a noisy queue
makes the buyer stop looking at it, and that destroys the whole protection.

**Plan with a stop criterion**: tighten the prompt → if precision doesn't clear 70%, change the
`critic` tier's model → if that fails too, remove it and document it in `08-not-done.md`.

**Why the critic is the right spot for the cheap model**: it can only downgrade, so disagreeing
without reason adds a review (cheap error) and agreeing when it shouldn't leaves the line as it
was (nothing gained, nothing lost). A component whose worst case is "no better than not having it"
doesn't need the expensive model.

---

---

## 5-ter. The critic's effort, measured and decided · 2026-08-22

The prompt never got touched, because there was a cheaper lever: **reasoning effort**. gpt-oss is
a model with thinking tokens, and the critic was inheriting the global effort (`medium`, chosen
for the extractor in §4). The critic's failure mode is the opposite of the extractor's: if it sees
too little, it doesn't get the attribute wrong — it **downgrades correct lines**. Repetition 2 of
`medium` confirmed it: it downgraded the *same* line, 5.2. It wasn't random, it was the effort
setting.

The dial was decoupled (`LLM_REASONING_EFFORT_CRITIC`) and `high` was measured in both experiments:

**On the gold set (experiment A, where there's nothing to find):**

| | Extractor `medium`, critic `medium` | Critic `high` |
|---|---|---|
| Silent error | 0% | 0% |
| Autonomy | 46.7% | **50.0%** |
| Queue noise | 6.3% (1 FP: line 5.2) | **0.0%** |
| Certain cells | 211/211 | 211/211 |
| Critic latency | 4.0 s/call | 2.3 s/call |

**On `mini`'s 7 known errors (experiment B, where accuracy is measured):**

| | Critic `medium`/default | Critic `high` |
|---|---|---|
| Hits | 2 (`1.3`, `5.3`) | **3 (`1.1`, `1.2`, `1.3`)** |
| False positives | 4 | **0** |
| Missed | 5 | 4 |
| **Recall** | 29% | **43%** |
| **Precision** | 33% | **100%** |
| Silent error (count) | 7 → 5 | **7 → 4** |
| Noise added | +31.8% | **+12.5%** |

The new hit is the hard one: `1.1` and `1.2` are the *"the standard contains the correct grade"*
variant (`ASTM A193, GR B7` in the quality field), which was missed at default. The reasons it
gives are literal and correct: *"the standard must go in the standard field and only GR B7 in
quality."*

**The 4 that are missed** (`5.1`, `5.2`, `5.3`, `12.1`) all share the same root cause: `mini`
invented the washer's quality, which the text doesn't carry. The critic checks attribution against
the text; a quality that's **absent** and the extractor filled in isn't a misplaced attribute, it's
data that doesn't exist. Catching it would mean *failing more strictly closed* (line 2 of the
target solution), not a limitation of this component.

**Decision: `LLM_REASONING_EFFORT_CRITIC=high`.** It clears the plan's stop criterion (precision
≥70% → 100%), with the same cheap model: the argument that "the critic is the right spot for the
open model" survives, and the plan's hypothesis 2 ("the model lacks the domain criterion") is
refuted — it had the criterion; what it lacked was thinking budget.

What has NOT been measured: `low` in the critic (unnecessary — `medium` already showed the failure
mode) and repetitions of `high` for recall variance. A single pass at 43% isn't a property; the
bound is that 100% precision and 0% noise on the gold set really are structural to the
*only-downgrade* verdict plus the high effort setting.

---

## 5-bis. The synthetic set separates what the gold set couldn't · 2026-08-22

The four models tied on the 30 gold-set lines stop being tied on the 64 rows targeted at catalog
gaps. This was §6.2's prediction, and it holds.

### Split fidelity on the synthetic set's multi-element rows

| Row | Design | `gpt-oss-120b` | `kimi-k3` |
|---|---|---|---|
| 35 · bolt + nut + 2 washers, HDG finish | 3 | **3** ✔ | **3** ✔ |
| 62 · 1:2:4 stud with ASTM grades | 3 | **3** ✔ | 1 ✖ |
| 63 · three different quality groups (G5/G9/G13) | 3 | 1 ✖ | 1 ✖ |
| 64 · bare secondary item (`with NUT`) | 2 | **2** ✔ | 1 ✖ |
| **Total lines** | **71** | **69** | 66 |

**`gpt-oss-120b` gets 3 of 4 right and `kimi-k3` gets 1 of 4**, with `gpt-oss-120b` costing 88×
less in output. On the gold set they were indistinguishable; here the cheap one is better.

> **Force correction, 2026-08-22 (later the same day).** This table is **one pass per model**, and
> we now know these rows fail ≈1 in every 4 runs (see below). With that much variance, 3-of-4
> against 1-of-4 on a single run each **doesn't hold up** the "clearly better" this line used to
> claim. What does hold up: `kimi-k3` failed **three** distinct rows and `gpt-oss-120b` failed one,
> and §2's conclusion — price doesn't predict quality — doesn't depend on this table, because it's
> supported by the gold set's split fidelity, which really has been repeated.
>
> For this comparison to mean what it's meant to, it needs to be repeated for both models. That's
> in §8. It's the same lesson as latency (§4) applied to a different metric: **a single measurement
> can't tell a worse model from a bad roll of the dice.**

**Both models fail row 63.** It's the hardest one in the set by design, and it has a quirk the
others don't: it lists the elements as a **comma-separated series** (`Conjunto: tornillo …,
tuerca …, 2 arandelas …`) instead of with a connector (`with`, `con`, `W/2`, `c/w`). Every example
in the prompt uses a connector. It's a concrete prompt-improvement target, not a model limitation.
**Done and measured**: next section.

### The comma-separated-series prompt · measured with repetitions · 2026-08-22

Row 63 was the target: the only multi-element row written as a **comma series**
(`Conjunto: tornillo …, tuerca …, 2 arandelas …`) instead of with a connector, and both good models
failed it. Every example in the prompt used a connector, so the separator was being learned from
the examples instead of from the rule.

Now the rule is stated for what it is — **the separator is irrelevant; what opens an element is
that the fragment names one of the five types** — with a second half that turned out to be
necessary because the first half alone made things worse: a group of attributes at the end of the
row (`, 8.8, zincado`) belongs **to the row**, not to the last element mentioned. Without that,
gold row 6 started giving the nut the bolt's quality and finish — exactly the failure the prompt
exists to prevent.

**3 runs with `LLM_CACHE=off`** (`pnpm run split:repeat`), plus the sample left in the cache:

| Row | Design | 3 runs | Cached sample | Verdict |
|---|---|---|---|---|
| 35 · bolt + nut + 2 washers | 3 | 3 · 3 · 3 | **1** | 3 of 4 |
| 62 · 1:2:4 stud with ASTM grades | 3 | 3 · 3 · 3 | 3 | stable ✔ |
| **63 · three quality groups (comma series)** | 3 | **3 · 3 · 2** | 3 | **fixed** · 3 of 4 |
| 64 · bare secondary item (`with NUT`) | 2 | 2 · 2 · 2 | 2 | **fixed** · stable ✔ |

**Result of the change**: row 63 goes from always failing to getting it right in 3 of 4 runs, and
row 64 goes from 1 to 2 stably. The gold set stays at **0% silent error** with all 211 certain
cells right, so the improvement wasn't paid for with a regression.

### Split fidelity has variance, and we hadn't been measuring it

This is the finding that matters more than the fix.

On the first pass row 35 came out as **1 element**, and I nearly wrote *"the prompt fixed 63 and
broke 35."* Three more runs gave 3, 3, and 3. What had happened is that the cache had saved
**one** degenerate run: a single element with `normalizedName: null` and `detectedName: "BOLT"`,
the whole row collapsed.

Consequences, stated plainly:

1. **The synthetic set's line count isn't a property of the system, it's a single run.** 65, 66,
   68, 69, and 71 are all samples from the same distribution. Any figure in this document that says
   "N lines" from a single pass says less than it looks like — including the §5-bis ones before this
   date.
2. **The cache makes an unstable measurement *look* stable**: it returns the same run forever.
   That's why `split:repeat` forces `LLM_CACHE=off` inside the script instead of trusting the
   environment.
3. The gold set really is stable: its 100% split has been reproduced many times. The ones that
   vary are the synthetic set's **deliberately difficult** rows, and they vary **≈1 in every 4
   runs**.

### What protects us when the split is a coin flip

`pnpm run gaps` on the synthetic set, with row 35's degenerate run cached:

```
UNPLACED_EVIDENCE  name="TUERCA"        rows 35, 54
UNPLACED_EVIDENCE  standard="ISO 4032"  rows 35, 54
UNPLACED_EVIDENCE  name="ARANDELA"      rows 15, 35
UNPLACED_EVIDENCE  standard="ISO 7089"  rows 15, 35
```

**The gap detector catches the collapsed row 35, with four gaps.** The nut, the washer, and their
two standards are left unplaced, and the row comes out flagged instead of coming out as a
three-line result.

It wasn't designed for this. `coverage.ts` was written for the **unknown-unknown**: cases no
policy covers. That it also catches the model's **non-determinism** is the best proof the
mechanism is the right one: it doesn't check *"did the model get it right?"*, it checks *"is
anything from the row left unexplained in the output?"*, and a broken split leaves plenty
unexplained.

Put in the sentence that matters to the client: **an unstable split isn't delivered silently.**
It's delivered as a row that owes an explanation, at zero cost and deterministically. It's exactly
the difference between failing out loud and failing silently from `docs/12`.

Side effect of the re-measurement: the synthetic set's gaps go from **6 in 3 rows** to **17 in 8
rows**, and not because the system got worse — because `UNPLACED_EVIDENCE` is doing two jobs at
once, and they need to be read separately:

| Class | Rows | What it is |
|---|---|---|
| Genuine policy gap | 49 (`45H`), 42, 43 | No rule covers the case: **decision pending** |
| Incomplete split detected | 11, 15, 31, 35, 54 | The model dropped an element: **not a decision, an extraction to be re-run** |

Telling them apart in the backlog is pending work and is listed in §8. Mixed together, the
decisions backlog fills up with things that aren't decisions — the same failure as noise in the
buyer's queue, one level up.

### Two bugs that only showed up here

Neither was seen by 88 tests or 8 models evaluated against the gold set.

**Rows that vanished silently.** With 0 elements extracted and `outOfFamily=false`, `validateRow`
returned `[]` and **the row evaporated**: no line, no reason, nothing to review. It's the worst
possible outcome the system can produce — worse than a bad extraction, because no one knows they
need to go looking for it — and it contradicted the principle already written for the
out-of-family case. Now it comes out as `NO_ELEMENTS_EXTRACTED`.

**Escaped quotes read as hallucination.** The evidence came back with the inch mark literally
escaped (`7/8\"`), `locate()` couldn't find it in the text, and **the element was discarded**. It
affects all imperial fastener hardware. The span verifier, designed to catch invention, was
destroying correct extractions.

With the fix, the synthetic set's line count went from 65 to 69.

### And a method error of my own

I nearly concluded that `gpt-oss-120b` split sets worse than `gpt-5.5`, comparing 65 lines against
71. **The 71 was measured with an earlier prompt**: changing it changed the cache key, so they
weren't the same measurement. The cache is what makes measuring cheap, and it's also what makes it
easy to compare apples to oranges without noticing. Every model comparison goes with an identical
prompt and an identical provider, or it doesn't count.

## 6. Limitations of these measurements

Stated before someone else states them.

**1. Harness-alignment artifact.** The 0% silent error rate for `deepseek-v4-pro` and
`qwen3.8-max` **isn't comparable** with `gpt-5.5`'s. When the split fails, the lines don't align
with the gold set and the harness compares fewer lines: a model that can't split sets gets a
**favored** silent error rate. Below 100% split, the figure isn't reliable.

**2. Sample size.** 30 lines. Enough to **rule out** — the four models that break sets are out
without discussion — and not enough to **distinguish** between the four that score 0%.

**3. Shared blind spot.** I wrote the gold set **and** the prompt. An error shared by both wouldn't
be caught by this measurement. What mitigates it are the 64 targeted synthetic rows — built from
the coverage gaps, not from the MTO — and the session day's blind set.

**4. The prompt is tuned on `gpt-5.5`.** The comparison measures "model X with a 5.5 prompt," not
model X's capability. For the ones that fail, tightening the prompt is a pending experiment.

**5. No repetitions on the open models.** A single pass per model, except for `gpt-5.5`. Given the
9× latency variance factor, the time figures are indicative.

---

## 6-bis. Policy gaps · the mechanism behind the rules

`pnpm run gaps`. Deterministic, zero cost, runs on every row.

| File | Rows | Gaps | Rows with a gap |
|---|---|---|---|
| Given MTO | 15 | **0** | 0% |
| Targeted synthetic set | 64 | **6** | 5% (3 rows) |

Zero on the known MTO is correct: the policies were written against that file. The synthetic set's
6 are all real, with no false positives:

| Gap | Row | What it exposes |
|---|---|---|
| `UNPLACED_EVIDENCE` name + standard + finish | 36 | The row (`ASME B18.2.1`) produced no elements: **everything it says is left unplaced**. Detected from a different angle than `NO_ELEMENTS_EXTRACTED` |
| `UNPLACED_EVIDENCE` standard `ISO 7050` | 43 | `DIN 7982 C-H` normalizes fine and no line carries it |
| `UNKNOWN_VALUE` quality `45H` | 49 | §5 would resolve it as-is; that rule is written with ASTM grades in mind |
| `UNCOVERED_DERIVATION` material | 49 | No vocabulary entry covers `45H`, so the line came out with **no material and silently** |

**On its very first run it found a standard-parser bug** no one had seen: in
`2 tuercas DIN 934 y 2 arandelas` the Spanish conjunction *"y"* ("and") got swallowed as a suffix,
producing `DIN 934 Y`. Invisible to 88 tests because the badly parsed standard still looked like a
standard; the gap caught it by no longer matching anything a line carried.

## 7. File-format robustness

10 variants with the **same 15 logical rows** and a different Excel layout, because the brief says
every design office writes it differently. Deterministic, zero cost. `pnpm run variants`, and part
of `pnpm test` as a regression check.

| Variant | What it targets | Result |
|---|---|---|
| `v01-control` | reference | ✔ |
| `v02-ingles-otro-orden` | column order, quantity not last | ✔ |
| `v03-qty-apostrofo` | `Q'TY`, no `ITEM` column | ✔ **after fix** |
| `v04-sin-cantidad` | quantity fully absent | ✔ warns at file level |
| `v05-descripcion-partida` | description split across two columns | ✔ |
| `v06-columnas-ruido` | `PROYECTO`/`WBS`/`REV`/`PESO` mixed in | ✔ |
| `v07-titulo-largo` | 5 header rows + a blank column | ✔ **after fix** |
| `v08-segunda-hoja` | data on the 2nd sheet | ✔ ignores it and reports the cover sheet |
| `v09-tipos-sucios` | quantities as text (`40,00`) | ✔ |
| `v10-frances` | headers in French | ✔ |

### Two bugs that only show up with a different format

**Sparse array.** ExcelJS returns a sparse `row.values`, and `Array.prototype.map` **preserves the
gaps**: it skips them. With a blank column before the headers, the `text === null` guard let an
`undefined.trim()` through and **ingestion crashed entirely**. No row in the given MTO triggers it.

**`Q'TY` not recognized.** One of the most common spellings in pipe MTOs, and the apostrophe broke
the regex: **the quantity for all 15 rows was lost**. Headers are now compared folded (no
diacritics, no punctuation).

### A product change that came out of this

An unrecognized quantity header produced **30 lines with the same reason**,
`QUANTITY_NOT_STATED`: a configuration problem disguised as thirty data problems, which is exactly
how a queue fills up with noise. Now it's flagged **once, at the file level, with the candidate
columns**, so a human fixes it once.

---

## 8. Not measured yet

- [ ] Full pipeline over the format variants (so far only ingestion).
- [ ] The 64 targeted synthetic rows against the four finalists: it's the only thing that can tell
      them apart, because that's where the 12 planted tests and the coverage gaps are. **Now with
      repetitions**: without them nothing can be attributed, see §5-bis.
- [ ] **Sweep of the 8 models with all eight cells.** §2's was measured over seven. ~€0.12.
- [ ] **Union of N critic passes**, implemented and measured instead of computed over the three
      passes already available (`specs/SPEC-006-critic.md`). ~$0.005 per MTO.
- [ ] **Separate the policy gap from the incomplete split in the backlog.** Today both come out as
      `UNPLACED_EVIDENCE` and they're different things: one is a decision the project owes, the
      other is an extraction that needs to be re-run.
- [ ] Second blind pass of the gold set → human error rate bound.
- [ ] Latency repetitions on the open models.
- [ ] Timed cold start. **Watch the order**: it deletes `data/output/.llm-cache`, and with it every
      saved run. It goes last, never before a measurement that depends on the cache.

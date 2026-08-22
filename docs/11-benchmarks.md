# Benchmarks

All the project's measurements, with their method, date, and limitations. This is the document
that section 3 of the 2-pager comes from, and the one used to answer the questions in the session.

**Total spend on measurement to date: €0.38.** What's expensive isn't measuring.

| Date | What was measured | Cost |
|---|---|---|
| 2026-08-22 | 8 models × 15 rows, twice (before and after the name fix) | €0.12 |
| 2026-08-22 | `kimi-k3` | €0.25 |
| 2026-08-22 | Critic, two experiments | €0.002 |
| 2026-08-22 | Cost and latency with cold cache, 3 repetitions | €0.01 |
| 2026-08-22 | 10 file-format variants | €0 (deterministic) |
| 2026-08-22 | Gold re-measurement with the 8 cells, synthetic set with the new prompt | €0.01 |
| 2026-08-22 | Critic on the frozen fixture, 3 repetitions with no cache | €0.004 |
| 2026-08-22 | Split of 4 rows × 3 repetitions with no cache (`split:repeat`) | €0.004 |

---

## 1. Method

**Against what.** `data/gold/gold.jsonl`: 15 rows → 30 lines, labeled by hand **before** the
pipeline existed. **Eight cells per line**: the seven attributes plus the quantity. Each one marked
`C` (derivable from the client's rules) or `P` (dependent on a declared policy). **Metrics are
computed over the `C` cells** — **211 of 240** — while `P` cells are reported as a sensitivity
analysis. A KPI that mixes the two partly measures our own opinion.

Quantity was added to the harness on 2026-08-22, after discovering it **was labeled but not being
compared**. See §3-bis: any figure dated before that day is blind to the one cell where a mistake
multiplies the order.

**What is measured.** Exact definitions in `02-kpi.md`:

- **Silent error** (primary), in both **rate and count**. `RESUELTA` lines with ≥1 certain cell
  wrong.
- **Useful autonomy**: resolved *and* correct, over the total.
- **Split fidelity**: rows with the correct number of lines. **Reported separately, never
  averaged in**: breaking a set isn't one wrong attribute, it's a material nobody buys.
- **Tail noise**: reviews the gold considers resolved.
- Cost €/row, latency, per-attribute breakdown.

**Joint-reading rule.** Silent error **is only interpreted together with split fidelity**. See §6.

**Reproduce with**: `npm run eval`, `npm run sweep`, `npm run cost`, `npm run variants`,
`npm run providers:check`.

---

## 2. Model comparison · final state

8 models × 15 rows, critic off (this measures the extractor).

> **Read with §3-bis in mind.** This table was measured over **seven** cells: quantity wasn't
> compared. It doesn't invalidate the conclusion — the ranking is decided by split fidelity, which
> doesn't depend on quantity — but the silent-error and autonomy columns are measured over 190
> cells, not 211. Repeating the full sweep with the eight cells costs ~€0.12 and is covered in §8.

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

`*` unreliable figure: see §6.

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
matches the reference, and the one at $6/M is the worst. Picking a model by rate would have been
picking wrong in both directions.

**`qwen3.8-max` is the degenerate case the brief warns about**: 3.3% autonomy and 62.5% noise. It's
*"a system that gets 100% right by sending 90% of the rows to review."* Ranked by silent error alone
it comes out **first**; it takes all four metrics for it to end up last. This is the validation of
the KPI.

---

## 3. The main finding: who decides the name

Before the fix, with the cache intact (the change is deterministic and happens **after** the model
call, so the comparison is over the **same responses**):

| Model | Silent err. | Autonomy |
|---|---|---|
| `gpt-oss-120b` | 13% → **0%** | 43% → **50%** |
| `qwen3-235b` | 21% → **0%** | 37% → **50%** |

`gpt-oss-120b` was only failing **two cells in the whole MTO**: `STUD BOLT` classified as
`VARILLA ROSCADA` in rows 1 and 12. Verified that it was returning the **correct** literal term
(`detectedName: "STUD BOLT"`) and only erred at **classification**.

The fix wasn't switching models or touching the prompt: it was **deciding who's in charge**. The
model reports *what text it saw*; the table in §3 decides *what it means*, because it's a closed
catalog of five values that `findAliases` resolves 100% of the time with the longest-alias-first
rule (`STUD BOLT` beats `BOLT`).

Put in money terms: correctly drawing the line between model and table is worth **13 points of
silent error** and moves the defensible cost from **€1,749 to €9 per site**. It's the evaluation
criterion *"knowing when an agent isn't needed"* with a number behind it.

---

## 3-bis. The eighth cell: the harness wasn't looking at quantity · 2026-08-22

**The finding that invalidates every previous measurement in this document**, and the most
expensive one, method-wise, of the session. It's stated first because it changes how §2 and §5
must be read.

`gold.jsonl` has labeled **eight** cells per line since day one: the seven attributes plus
**quantity**, with its own certain/policy split (21 certain, 9 policy). `evaluate()` was comparing
seven. The cell loop iterated over `ATTRIBUTE_KEYS`, and quantity isn't in that list.

Consequence: a line asking for **10,000 bolts where the MTO asks for 100** came out with a perfect
breakdown. And it isn't hypothetical — it was the actual state of two lines from `gpt-5.4-mini`.

### How it surfaced

Neither a test nor a code review found it. **The critic** found it, and that's why this section is
also the best defense that component has.

In the experiment in §5 the critic flagged lines `4.1` and `7.1`, and both were counted as
**false positives** because no metric saw anything wrong with them. It was right both times: the
model had carried the number from the **quantity column** into the **multiplicity** field, and the
pipeline obediently multiplied. 100 sets → 10,000 bolts. 50 → 2,500.

In other words: the critic's precision was underestimated because it was being measured against a
blind harness. A safety component judged by a judge that wasn't looking where it was looking.

### What was fixed, in three layers

| Layer | What |
|---|---|
| The judge | Quantity is the eighth gradable cell. It doesn't enter the attribute breakdown — it isn't part of the catalog — but it **does count toward silent error**: it's the only field where a mistake *multiplies* the order |
| The policy | P-2 has said "multiplicity 1 if not written" since day one, and the code was applying the model's number without checking. That was the real path to the 10,000 |
| The rule | Multiplicity **is decided by the row**, with a regex over the text. Contract and shape table in `specs/SPEC-002-set-splitter.md` |

**Denominator of certain cells: 190/210 → 211/240.** Any figure in this document dated before this
section is blind to quantity.

### Gold state with the eight cells · `gpt-oss-120b`

The project's first measurement to score all eight and get every one right.

| | Value |
|---|---|
| Lines | 30 / 30 |
| Split fidelity | **100%** (15/15 rows) |
| **Silent error** | **0%** |
| Useful autonomy | 50.0% |
| Tail noise | 0% |
| All 7 attributes | 100% certain |
| **Quantity** | **21/21 certain · 9/9 policy** |
| Rejected multiplicities | 0 |

The 0 rejected multiplicities are the honest signal: in this file the row and the model agree
everywhere. The guard isn't papering over a disagreement, it's confirming there isn't one.

### The same line drawn three times

That makes **three** decisions moved from the model to a table, and all three closed a real error:

| Decision | Before | Now | What it was worth |
|---|---|---|---|
| The **name** | model classification | `findNames` over the literal term | 13 points of silent error (§3) |
| The **length** inside `M16x60` | a second JSON field | regex over the ISO designation | 1 line resolvable per row with length in the designation |
| The **multiplicity** | number from the model | regex over the row, anchored to the name | 2 lines with the order multiplied by the order size |

It isn't the same coincidence three times. It's the same criterion: **wherever a closed rule can
decide, the model doesn't get a vote.** And it's the numeric answer to the criterion *"knowing when
an agent isn't needed."*

### The same methodological error, again

Worth stating because it's the same one from §5-bis wearing a different face. The first fix for
multiplicity asked **the model** for evidence and verified it. An hour later, the critic's frozen
fixture — recorded **before** that field existed — failed the check on every one of its
multiplicities and turned 80 nuts into 40. The critic flagged those lines, correctly, and they
looked like model extraction errors.

A guard that turns missing metadata into a wrong number is worse than the gap it was closing. And
the measurement the critic was being judged by was contaminated by my own fix. **Every measurement
of a component is taken over a pipeline in some state, and that state is part of the measurement.**

And a third one, from the same day: the regex was anchored to the **start of the element's
evidence** instead of to the **name**. The model returns `W/2 HEX. NUT 7/8"` as evidence, so the `2`
falls *inside* the span and went unnoticed: the **five** real multiplicities in the MTO were
rejected and silent error rose to 13.3%. No unit test caught it, because they all built the evidence
starting cleanly at the name — **the test and the code shared a premise that neither had checked
against a real response.** The gold caught it.

---

## 4. Cost and latency

Tokens measured on the real MTO: **1,730 input / 652 output per row**.

| Configuration | €/row | € per site (4,000 rows × 25 rev.) | vs manual |
|---|---|---|---|
| Manual (90 s/row, €35/h) | 0.875 | 87,500 | — |
| `gpt-5.5` | 0.0175 | 1,749 | 2.0% |
| `kimi-k3` | 0.0169 | ~1,240 | 1.4% |
| **`gpt-oss-120b`** | **0.000095** | **9** | **0.01%** |

**96% of cost at scale is output tokens.** Caching more input buys almost nothing; the levers are
output verbosity and model choice.

### Latency can't be promised

`gpt-5.5`, three identical repetitions: **6.9 · 44.0 · 64.5 s/row**. A factor of 9.

This invalidated an argument I myself had built on a single measurement of 24.8 s. **Cost is
stable (±5%) because tokens are nearly deterministic; latency is not stable at all.**

Consequence for the commitment: don't promise a latency whose variance belongs to the provider.
Promise throughput with margin, and a plan for when it falls out of range. Every "minutes for 1,000
lines" figure comes with its range.

---

## 5. The critic

`openai/gpt-oss-120b`, routed by decomposition risk (9 of 15 rows).

**Experiment A — on a pipeline with 0% silent error:**

| | Without critic | With critic |
|---|---|---|
| Silent error | 0% | 0% |
| Autonomy | 50.0% | **26.7%** |
| Tail noise | 0% | **31.8%** |

Degraded 7 of 8 correct lines. And a domain mistake: it warned that "material=ZN is missing," when
`ZN` is a **finish**, not a material.

**Experiment B — on the output of `gpt-5.4-mini`, with 7 known real errors:**

| | Lines | |
|---|---|---|
| Hits | `1.3`, `5.3` | 2 |
| False positives | `2.1`, `7.1`, `7.2`, `9.1` | 4 |
| Missed | `1.1`, `1.2`, `5.1`, `5.2`, `12.1` | 5 |

**Recall 29% · Precision 33%.**

**The concept works; the implementation doesn't get there.** The two hits are exactly what only
this component can catch: the washer with no quality that `mini` put a **standard**
(`ASTM F436`) into the quality field. The span verifier doesn't detect it because the value really
is in the text: the failure is one of **attribution**, not invention.

The blocker isn't the low recall, it's the **31.8% noise**: the brief warns that a noisy tail makes
the buyer stop looking at it, and that destroys the entire protection.

**Plan with a stop criterion**: tighten the prompt → if precision doesn't clear 70%, switch the
model at the `critic` tier → if that doesn't work either, drop it and document it in
`08-not-done.md`.

**Why the critic is the place for the cheap model**: it can only degrade, so disagreeing without
reason adds a review (a cheap mistake) and agreeing when it shouldn't leaves the line as it was (no
gain, no loss). A component whose worst case is "no better than not having it" doesn't need the
expensive model.

---

## 5-bis. The synthetic set separates what the gold couldn't · 2026-08-22

The four models tied on the gold's 30 lines stop being tied on the 64 rows targeting catalog gaps.
It was the prediction in §6.2, and it holds.

### Split fidelity on the synthetic set's multi-element rows

| Row | Design | `gpt-oss-120b` | `kimi-k3` |
|---|---|---|---|
| 35 · bolt + nut + 2 washers, HDG finish | 3 | **3** ✔ | **3** ✔ |
| 62 · stud bolt 1:2:4 with ASTM grades | 3 | **3** ✔ | 1 ✖ |
| 63 · three distinct quality groups (G5/G9/G13) | 3 | 1 ✖ | 1 ✖ |
| 64 · bare secondary (`with NUT`) | 2 | **2** ✔ | 1 ✖ |
| **Total lines** | **71** | **69** | 66 |

**`gpt-oss-120b` gets 3 of 4 right and `kimi-k3` gets 1 of 4**, with `gpt-oss-120b` costing 88×
less on output. On the gold they were indistinguishable; here the cheap one is better.

> **Force correction, 2026-08-22 (later the same day).** This table is **one pass per model**, and
> we now know these rows fail ≈1 run in 4 (see below). With that variance, 3-of-4 vs 1-of-4 on a
> single run each **doesn't hold up** the "clearly better" this line used to claim. What does hold
> up: `kimi-k3` failed **three** different rows and `gpt-oss-120b` failed one, and the conclusion
> in §2 — price doesn't predict quality — doesn't depend on this table, because it's backed by the
> gold's split fidelity, which really is repeated.
>
> For this comparison to mean what it claims, it needs to be repeated on both models. It's in §8.
> It's the same lesson as latency (§4) applied to another metric: **a single measurement doesn't
> tell a worse model apart from a bad run.**

**Both fail row 63.** It's the hardest one in the set by design, and it has a peculiarity the
others don't: it lists the elements as a **comma-separated series** (`Assembly: bolt …, nut …,
2 washers …`) instead of with a connector (`with`, `con`, `W/2`, `c/w`). Every example in the prompt
uses a connector. This is a concrete prompt-improvement target, not a model limitation.
**Done and measured**: next section.

### The comma-separated-series prompt · measured with repetitions · 2026-08-22

Row 63 was the target: the only multi-element row written as a **comma series**
(`Assembly: bolt …, nut …, 2 washers …`) instead of with a connector, and both good models failed
it. Every prompt example used a connector, so the model was learning the separator from the
examples rather than from the rule.

Now the rule is stated for what it is — **the separator is irrelevant; what opens an element is
that the fragment names one of the five types** — with a second half that turned out to be
necessary because the first one alone made things worse: a group of attributes at the end of the
row (`, 8.8, zinc-plated`) belongs **to the row**, not to the last element mentioned. Without that,
gold row 6 started giving the nut the bolt's quality and finish — the exact mistake the prompt
exists to prevent.

**3 passes with `LLM_CACHE=off`** (`npm run split:repeat`), plus the sample that stayed cached:

| Row | Design | 3 passes | Cached sample | Verdict |
|---|---|---|---|---|
| 35 · bolt + nut + 2 washers | 3 | 3 · 3 · 3 | **1** | 3 of 4 |
| 62 · stud bolt 1:2:4 with ASTM grades | 3 | 3 · 3 · 3 | 3 | stable ✔ |
| **63 · three quality groups (comma series)** | 3 | **3 · 3 · 2** | 3 | **fixed** · 3 of 4 |
| 64 · bare secondary (`with NUT`) | 2 | 2 · 2 · 2 | 2 | **fixed** · stable ✔ |

**Result of the change**: row 63 goes from always failing to getting it right in 3 of 4 runs, and
row 64 from 1 to 2, stably. The gold stays at **0% silent error** with all 211 certain cells
correct, so the improvement wasn't paid for with a regression.

### Split fidelity has variance, and we hadn't measured it

This is the finding that matters more than the fix.

On the first pass, row 35 gave **1 element**, and I was about to write *"the prompt fixed 63 and
broke 35."* Three more runs gave 3, 3, and 3. What had happened is that the cache was holding
**one** degenerate run: a single element with `normalizedName: null` and `detectedName: "BOLT"`,
the entire row collapsed.

Consequences, stated plainly:

1. **The synthetic set's line count isn't a property of the system, it's a single run.** 65, 66,
   68, 69, and 71 are all samples from the same distribution. Any figure in this document that says
   "N lines" from a single pass says less than it appears to — including those in §5-bis before
   this date.
2. **The cache makes an unstable measurement *look* stable**: it returns the same run forever.
   That's why `split:repeat` forces `LLM_CACHE=off` inside the script instead of relying on the
   environment.
3. The gold really is stable: its 100% split has been reproduced many times. What varies are the
   synthetic set's **deliberately hard** rows, and they vary **≈1 run in 4**.

### What protects when the split is a coin toss

`npm run gaps` on the synthetic set, with row 35's degenerate run in the cache:

```
UNPLACED_EVIDENCE  name="TUERCA"        rows 35, 54
UNPLACED_EVIDENCE  standard="ISO 4032"  rows 35, 54
UNPLACED_EVIDENCE  name="ARANDELA"      rows 15, 35
UNPLACED_EVIDENCE  standard="ISO 7089"  rows 15, 35
```

**The gap detector catches the collapsed row 35, with four gaps.** The nut, the washer, and their
two standards are left unplaced, and the row comes out flagged instead of coming out as a
three-element line.

It wasn't designed for this. `coverage.ts` was written for the **unknown-unknown**: cases no
policy covers. The fact that it also catches the **model's non-determinism** is the best proof
that the mechanism is the right one: it doesn't check *"did the model get it right?"*, it checks
*"is there anything left in the row that the output doesn't explain?"*, and a broken split leaves a
lot unexplained.

Put in the phrase that matters to the client: **an unstable split isn't delivered silently.** It's
delivered as a row that owes an explanation, at zero cost and deterministically. It's exactly the
difference between failing loudly and failing silently from `docs/12`.

Side effect of the re-measurement: gaps in the synthetic set go from **6 in 3 rows** to **17 in 8
rows**, and not because the system got worse — because `UNPLACED_EVIDENCE` is doing two jobs at
once, and they need to be read separately:

| Class | Rows | What it is |
|---|---|---|
| Genuine policy gap | 49 (`45H`), 42, 43 | No rule covers the case: **a pending decision** |
| Incomplete split detected | 11, 15, 31, 35, 54 | The model left an element out: **not a decision, an extraction to redo** |

Telling them apart in the backlog is pending work and is covered in §8. Mixed together, the
decision backlog fills up with things that aren't decisions — the same failure as noise in the
buyer's tail, one floor up.

### Two bugs that only showed up here

Neither was caught by 88 tests or the 8 models evaluated on the gold.

**Rows disappearing silently.** With 0 elements extracted and `outOfFamily=false`, `validateRow`
returned `[]` and **the row evaporated**: no line, no reason, nothing to review. It's the worst
possible outcome for the system — worse than extracting wrong, because nobody knows they need to
look for it — and it contradicted the principle we'd already written for the provider-failure
case. It now comes out as `NO_ELEMENTS_EXTRACTED`.

**Escaped quotes read as hallucination.** The evidence came back with the inch mark literally
escaped (`7/8\"`), `locate()` couldn't find it in the text, and **the element was dropped**. It
affects all imperial fasteners. The span verifier, designed to detect invention, was destroying
correct extractions.

With the fix, the synthetic set's lines went from 65 to 69.

### And a methodological error of my own

I nearly concluded that `gpt-oss-120b` split sets worse than `gpt-5.5`, comparing 65 lines against
71. **The 71 were measured with an earlier prompt**: changing it changed the cache key, so they
weren't the same measurement. The cache is what makes measurements cheap, and it's also what makes
it easy to compare apples to oranges without noticing. Every model comparison runs with an
identical prompt and an identical provider, or it doesn't count.

## 6. Limitations of these measurements

Stated before someone else states them.

**1. Harness alignment artifact.** The 0% silent error for `deepseek-v4-pro` and `qwen3.8-max`
**isn't comparable** to `gpt-5.5`'s. When the split fails, the lines don't align with the gold and
the harness compares fewer lines: a model that can't split sets correctly gets a **favored** silent
error figure. Below 100% split, the number isn't reliable.

**2. Sample size.** 30 lines. Enough to **rule out** — the four models that break sets are ruled
out without argument — and not enough to **distinguish** among the four that score 0%.

**3. Shared blind spot.** I wrote the gold **and** the prompt. An error shared by both wouldn't be
caught by this measurement. What mitigates it is the 64 targeted synthetic rows — built from the
coverage gaps, not from the MTO — and the session-day blind set.

**4. The prompt is tuned on `gpt-5.5`.** The comparison measures "model X with a 5.5 prompt," not
model X's raw capability. For the ones that fail, tightening the prompt is a pending experiment.

**5. No repetition on the open models.** A single pass per model, except `gpt-5.5`. Given the
factor-of-9 latency variance, the timing figures are indicative only.

---

## 6-bis. Policy gaps · the mechanism behind the rules

`npm run gaps`. Deterministic, zero cost, runs on every row.

| File | Rows | Gaps | Rows with a gap |
|---|---|---|---|
| Given MTO | 15 | **0** | 0% |
| Targeted synthetic set | 64 | **6** | 5% (3 rows) |

Zero on the known MTO is correct: the policies were written against that file. The 6 in the
synthetic set are all real, with no false positives:

| Gap | Row | What it exposes |
|---|---|---|
| `UNPLACED_EVIDENCE` name + standard + finish | 36 | The row (`ASME B18.2.1`) produced no elements: **everything it says is left unplaced**. Detected from a different angle than `NO_ELEMENTS_EXTRACTED` |
| `UNPLACED_EVIDENCE` standard `ISO 7050` | 43 | `DIN 7982 C-H` normalizes fine and no line carries it |
| `UNKNOWN_VALUE` quality `45H` | 49 | §5 would resolve it as-is; that rule is written with ASTM grades in mind |
| `UNCOVERED_DERIVATION` material | 49 | No vocabulary entry covers `45H`, so the line came out **with no material, silently** |

**On its first run it found a standards-parser bug** nobody had seen: in
`2 nuts DIN 934 and 2 washers` (Spanish: `2 tuercas DIN 934 y 2 arandelas`) the Spanish conjunction
*"y"* ("and") was swallowed as a suffix, producing `DIN 934 Y`. Invisible to 88 tests because the
mis-parsed standard still looked like a standard; the gap caught it by no longer matching any
line that carried it.

## 7. File-format robustness

10 variants with the **same 15 logical rows** and different Excel shapes, because the brief says
every study writes differently. Deterministic, zero cost. `npm run variants`, and part of
`npm test` as a regression check.

| Variant | What it targets | Result |
|---|---|---|
| `v01-control` | reference | ✔ |
| `v02-ingles-otro-orden` | column order, quantity not last | ✔ |
| `v03-qty-apostrofo` | `Q'TY`, no `ITEM` column | ✔ **after fix** |
| `v04-sin-cantidad` | quantity missing entirely | ✔ warns at file level |
| `v05-descripcion-partida` | description split across two columns | ✔ |
| `v06-columnas-ruido` | `PROYECTO`/`WBS`/`REV`/`PESO` mixed in | ✔ |
| `v07-titulo-largo` | 5 header rows + a blank column | ✔ **after fix** |
| `v08-segunda-hoja` | data on the 2nd sheet | ✔ ignores it and reports the cover sheet |
| `v09-tipos-sucios` | quantities as text (`40,00`) | ✔ |
| `v10-frances` | headers in French | ✔ |

### Two bugs that only appear with another format

**Sparse array.** ExcelJS returns a sparse `row.values`, and `Array.prototype.map` **preserves the
gaps**: it skips them. With a blank column before the headers, the `text === null` guard let an
`undefined.trim()` through and **ingestion crashed entirely**. No row in the given MTO triggers it.

**`Q'TY` not recognized.** One of the most common spellings in piping MTOs, and the apostrophe
broke the regex: **the quantity for all 15 rows was lost**. Headers are now compared after folding
(no diacritics, no punctuation).

### A product change that came out of this

An unrecognized quantity header produced **30 lines with the same reason**, `QUANTITY_NOT_STATED`:
a configuration problem disguised as thirty data problems, which is exactly how a tail fills up
with noise. It now warns **once, at file level, listing the candidate columns**, so a human can
fix it once.

---

## 8. Not yet measured

- [ ] Full pipeline over the format variants (so far only ingestion).
- [ ] The 64 targeted synthetic rows against the four finalists: it's the only thing that can tell
      them apart, because that's where the 12 planted tests and the coverage gaps are. **Now with
      repetitions**: without them nothing can be attributed, see §5-bis.
- [ ] **Sweep of the 8 models with the eight cells.** The one in §2 was measured over seven.
      ~€0.12.
- [ ] **Merging N critic passes**, implemented and measured instead of calculated over the three
      passes that already exist (`specs/SPEC-006-critic.md`). ~$0.005 per MTO.
- [ ] **Separating the policy gap from the incomplete split in the backlog.** Today both come out
      as `UNPLACED_EVIDENCE` and they're different things: one is a decision the project owes, the
      other an extraction that needs redoing.
- [ ] Second blind pass of the gold set → bound on the human error rate.
- [ ] Latency repetitions on the open models.
- [ ] Timed cold start. **Mind the order**: it deletes `data/output/.llm-cache`, and with it every
      saved run. It goes last, never before a measurement that depends on the cache.

# Benchmarks

All project measurements, with their method, date, and limitations. This is the document
section 3 of the 2-pager comes from, and the one used to answer session questions.

**Total spend on measurement to date: €0.38.** Measuring isn't the expensive part.

| Date | What was measured | Cost |
|---|---|---|
| 2026-08-22 | 8 models × 15 rows, twice (before and after the name fix) | €0.12 |
| 2026-08-22 | `kimi-k3` | €0.25 |
| 2026-08-22 | Critic, two experiments | €0.002 |
| 2026-08-22 | Cost and latency with cold cache, 3 repetitions | €0.01 |
| 2026-08-22 | 10 file-format variants | €0 (deterministic) |

---

## 1. Method

**Against what.** `data/gold/gold.jsonl`: 15 rows → 30 lines, hand-labeled **before** the pipeline
existed. Each cell marked `C` (deducible from the client's rules) or `P` (dependent on a declared
policy). **Metrics are calculated over `C` cells**; `P` cells are reported as sensitivity. A KPI that
mixes the two partly measures our own opinion.

**What's measured.** Exact definitions in `02-kpi.md`:

- **Silent error** (primary), in **rate and count**. `RESUELTA` lines with ≥1 wrong certain cell.
- **Useful autonomy**: resolved *and* correct out of the total.
- **Split fidelity**: rows with the correct number of lines. **Reported separately, never
  averaged**: breaking a set isn't a wrong attribute, it's a material nobody buys.
- **Queue noise**: reviews the gold considers already resolved.
- Cost €/row, latency, breakdown by attribute.

**Joint-reading rule.** Silent error **is only meaningful read together with split fidelity**.
See §6.

**To reproduce**: `npm run eval`, `npm run sweep`, `npm run cost`, `npm run variants`,
`npm run providers:check`.

---

## 2. Model comparison · final state

8 models × 15 rows, critic off (this measures the extractor).

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

**Breakdown by attribute (certain cells)**

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
100% → 100% → 47% → 67% → 87% → 100% → 100% → **100%**. The **cheapest** open model of the
eight matches the reference, and the one at $6/M is the worst. Choosing a model by rate would have
been the wrong choice in both directions.

**`qwen3.8-max` is the degenerate case the brief warns about**: 3.3% autonomy and 62.5% noise.
It's *"a system that gets 100% right by sending 90% of the rows to review."* Ranked by silent
error alone it comes out **first**; all four metrics are needed for it to end up last. This
validates the KPI.

---

## 3. The main finding: who decides the name

Before the fix, with the cache intact (the change is deterministic and comes **after** the
model call, so the comparison is over the **same responses**):

| Model | Silent err. | Autonomy |
|---|---|---|
| `gpt-oss-120b` | 13% → **0%** | 43% → **50%** |
| `qwen3-235b` | 21% → **0%** | 37% → **50%** |

`gpt-oss-120b` failed **two cells in the whole MTO**: `STUD BOLT` classified as
`VARILLA ROSCADA` in rows 1 and 12. Verified that it returned the **correct** literal term
(`detectedName: "STUD BOLT"`) and only got the **classification** wrong.

The fix wasn't switching models or touching the prompt: it was **deciding who's in charge**. The
model reports *what text it saw*; the §3 table decides *what it means*, because it's a closed
catalog of five values that `findAliases` resolves at 100% with the longest-alias-first rule
(`STUD BOLT` beats `BOLT`).

Put in money: getting the boundary right between model and table is worth **13 points of silent
error** and moves the defensible cost from **€1,749 to €9 per site**. It's the evaluation criterion
*"whether you know when an agent isn't needed"* with a number behind it.

---

## 4. Cost and latency

Tokens measured on the real MTO: **1,730 input / 652 output per row**.

| Configuration | €/row | € per site (4,000 rows × 25 rev.) | vs. manual |
|---|---|---|---|
| Manual (90 s/row, €35/h) | 0.875 | 87,500 | — |
| `gpt-5.5` | 0.0175 | 1,749 | 2.0% |
| `kimi-k3` | 0.0169 | ~1,240 | 1.4% |
| **`gpt-oss-120b`** | **0.000095** | **9** | **0.01%** |

**96% of the cost at scale is output tokens.** Caching more input barely buys anything; the
levers are output verbosity and model choice.

### Latency can't be promised

`gpt-5.5`, three identical repetitions: **6.9 · 44.0 · 64.5 s/row**. A factor of 9.

This invalidated an argument I had myself built on a single 24.8 s measurement. **Cost is
stable (±5%) because tokens are nearly deterministic; latency is not stable at all.**

Consequence for the commitment: no latency is promised whose variance belongs to the provider. What's
promised is throughput with margin and a plan if it falls out of range. Every "minutes for 1,000
lines" figure comes with its range.

---

## 5. The critic

`openai/gpt-oss-120b`, routed by decomposition risk (9 of 15 rows).

**Experiment A — on a pipeline with 0% silent error:**

| | Without critic | With critic |
|---|---|---|
| Silent error | 0% | 0% |
| Autonomy | 50.0% | **26.7%** |
| Queue noise | 0% | **31.8%** |

Degraded 7 of 8 correct lines. And a domain error: it flagged "material=ZN missing," when
`ZN` is a **finish**, not a material.

**Experiment B — on `gpt-5.4-mini`'s output, with 7 known real errors:**

| | Lines | |
|---|---|---|
| Hits | `1.3`, `5.3` | 2 |
| False positives | `2.1`, `7.1`, `7.2`, `9.1` | 4 |
| Missed | `1.1`, `1.2`, `5.1`, `5.2`, `12.1` | 5 |

**Recall 29% · Precision 33%.**

**The concept works; the implementation doesn't get there.** The two hits are exactly the ones only
this component can catch: the washer with no grade that `mini` put a **standard** in the
grade field (`ASTM F436`). The span verifier doesn't catch it because the value really is in
the text: the failure is one of **attribution**, not invention.

The blocker isn't the low recall, it's the **31.8% noise**: the brief warns that a noisy queue
makes the buyer stop looking at it, and that destroys the whole protection.

**Plan with a stopping criterion**: tighten the prompt → if precision doesn't clear 70%, change the
`critic` tier's model → if that doesn't work either, remove it and document it in
`08-not-done.md`.

**Why the critic is the place for the cheap model**: it can only degrade, so disagreeing without
reason adds a review (cheap error) and agreeing when it shouldn't leaves the line as it was (nothing
gained, nothing lost). A component whose worst case is "no better than not having it" doesn't need
the expensive model.

---

## 6. Limitations of these measurements

Stated before anyone else states them.

**1. Harness alignment artifact.** The 0% silent error for `deepseek-v4-pro` and
`qwen3.8-max` **is not comparable** to `gpt-5.5`'s. When the split fails, the lines don't
align with the gold and the harness compares fewer lines: a model that can't split sets gets a
**favorably biased** silent error. Below 100% split, the figure isn't reliable.

**2. Sample size.** 30 lines. Enough to **rule out** — the four models that break sets are out
without discussion — and not enough to **distinguish** among the four that score 0%.

**3. Shared blind spot.** I wrote the gold set **and** the prompt. An error shared by both isn't
caught by this measurement. What mitigates it is the 64 targeted synthetic rows — built from the
coverage gaps, not from the MTO — and the blind set from session day.

**4. The prompt is tuned on `gpt-5.5`.** The comparison measures "model X with a 5.5-style prompt,"
not model X's raw capability. For the ones that fail, tightening the prompt is a pending experiment.

**5. No repetitions on the open models.** A single pass per model, except `gpt-5.5`. Given the
factor-9 latency variance, timing figures are indicative only.

---

## 7. File-format robustness

10 variants with the **same 15 logical rows** and different Excel shapes, because the brief says
every studio writes differently. Deterministic, €0 cost. `npm run variants`, and in `npm test` as a
regression.

| Variant | What it attacks | Result |
|---|---|---|
| `v01-control` | reference | ✔ |
| `v02-ingles-otro-orden` | column order, quantity not last | ✔ |
| `v03-qty-apostrofo` | `Q'TY`, no `ITEM` column | ✔ **after fix** |
| `v04-sin-cantidad` | total absence of quantity | ✔ warns at file level |
| `v05-descripcion-partida` | description split across two columns | ✔ |
| `v06-columnas-ruido` | `PROYECTO`/`WBS`/`REV`/`PESO` mixed in | ✔ |
| `v07-titulo-largo` | 5-row cover block + blank column | ✔ **after fix** |
| `v08-segunda-hoja` | data on the 2nd sheet | ✔ ignores it and reports the cover sheet |
| `v09-tipos-sucios` | quantities as text (`40,00`) | ✔ |
| `v10-frances` | headers in French | ✔ |

### Two bugs that only show up with a different format

**Sparse array.** ExcelJS returns a sparse `row.values`, and `Array.prototype.map` **preserves the
gaps**: it skips them. With a blank column before the headers, the `text === null` guard let an
`undefined.trim()` through and **ingestion crashed entirely**. No row in the given MTO triggers this.

**`Q'TY` not recognized.** One of the most common spellings in piping MTOs, and the apostrophe broke
the regex: **the quantity for all 15 rows was lost**. Headers are now compared folded (no
diacritics, no punctuation).

### A product change that came out of this

An unrecognized quantity header produced **30 lines with the same reason**,
`QUANTITY_NOT_STATED`: a configuration problem disguised as thirty data problems, which is
exactly how a queue fills up with noise. Now it warns **once, at the file level, with the
candidate columns**, so a human fixes it once.

---

## 8. Not yet measured

- [ ] Full pipeline over the format variants (so far only ingestion).
- [ ] The 64 targeted synthetic rows against the four finalists: this is the only thing that can
      distinguish them, because that's where the 12 planted tests and the coverage gaps live.
- [ ] Critic with the tightened prompt.
- [ ] Second blind pass of the gold set → bound on the human error rate.
- [ ] Latency repetitions on the open models.

# Benchmarks

All the project's measurements, with their method, date, and limitations. This is the document
section 3 of the 2-pager comes from, and the one used to answer the session's questions.

**Total spend on measurement to date: €0.38.** Measuring isn't what's expensive.

| Date | What was measured | Cost |
|---|---|---|
| 2026-08-22 | 8 models × 15 rows, twice (before and after the name fix) | €0.12 |
| 2026-08-22 | `kimi-k3` | €0.25 |
| 2026-08-22 | Critic, two experiments | €0.002 |
| 2026-08-22 | Cost and latency with a cold cache, 3 repetitions | €0.01 |
| 2026-08-22 | 10 file-format variants | €0 (deterministic) |

---

## 1. Method

**Against what.** `data/gold/gold.jsonl`: 15 rows → 30 lines, hand-labeled **before** the pipeline
existed. Each cell marked `C` (deducible from the client's rules) or `P` (dependent on a declared
policy). **Metrics are calculated over the `C` cells**; the `P` ones are reported as sensitivity. A
KPI that mixes the two is partly measuring our own opinion.

**What is measured.** Exact definitions in `02-kpi.md`:

- **Silent error** (primary), as **rate and count**. `RESOLVED` lines with ≥1 certain cell wrong.
- **Useful autonomy**: resolved *and* correct out of the total.
- **Split fidelity**: rows with the correct number of lines. **Reported separately, never
  averaged**: breaking a set isn't a wrong attribute, it's a material nobody buys.
- **Queue noise**: reviews that gold considers already resolved.
- Cost €/row, latency, per-attribute breakdown.

**Joint-reading rule.** The silent error **can only be interpreted together with split fidelity**.
See §6.

**Reproduce**: `npm run eval`, `npm run sweep`, `npm run cost`, `npm run variants`,
`npm run providers:check`.

---

## 2. Model comparison · final state

8 models × 15 rows, critic off (the extractor is what's measured here).

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
matches the reference, and the one at $6/M is the worst. Choosing the model by price would have
been wrong in both directions.

**`qwen3.8-max` is the degenerate case the brief warns about**: 3.3% autonomy and 62.5% noise. It's
*"a system that gets 100% right by sending 90% of the rows to review."* Ranked by silent error
alone it comes out **first**; all four metrics are needed for it to end up last. This is the
validation of the KPI.

---

## 3. The main finding: who decides the name

Before the fix, with the cache intact (the change is deterministic and comes **after** the model
call, so the comparison is over the **same responses**):

| Model | Silent err. | Autonomy |
|---|---|---|
| `gpt-oss-120b` | 13% → **0%** | 43% → **50%** |
| `qwen3-235b` | 21% → **0%** | 37% → **50%** |

`gpt-oss-120b` was failing **two cells in the entire MTO**: `STUD BOLT` classified as
`VARILLA ROSCADA` in rows 1 and 12. Verified that it returned the **correct** literal term
(`detectedName: "STUD BOLT"`) and only got the **classification** wrong.

The fix wasn't changing model or touching the prompt: it was **deciding who's in charge**. The model
reports *what text it saw*; the table in §3 decides *what it means*, because it's a closed catalog
of five values that `findAliases` resolves at 100% with the longest-alias-first rule
(`STUD BOLT` beats `BOLT`).

Put in money: getting the boundary right between model and table is worth **13 points of silent
error** and moves the defensible cost from **€1,749 to €9 per project**. It's the evaluation
criterion *"whether you know when an agent isn't needed"* with a number behind it.

---

## 4. Cost and latency

Tokens measured on the real MTO: **1,730 input / 652 output per row**.

| Configuration | €/row | € per project (4,000 rows × 25 rev.) | vs manual |
|---|---|---|---|
| Manual (90 s/row, €35/h) | 0.875 | 87,500 | — |
| `gpt-5.5` | 0.0175 | 1,749 | 2.0% |
| `kimi-k3` | 0.0169 | ~1,240 | 1.4% |
| **`gpt-oss-120b`** | **0.000095** | **9** | **0.01%** |

**96% of the cost at scale is output tokens.** Caching more input buys almost nothing; the levers
are output verbosity and model choice.

### Latency can't be promised

`gpt-5.5`, three identical repetitions: **6.9 · 44.0 · 64.5 s/row**. A factor of 9.

This invalidated an argument I myself had built on a single 24.8 s measurement. **Cost is stable
(±5%) because tokens are nearly deterministic; latency isn't at all.**

Consequence for the commitment: no latency figure is promised whose variance belongs to the
provider. What's promised is throughput with margin and a plan if it drifts out of range. Every
"minutes for 1,000 lines" figure comes with its range.

---

## 5. The critic

`openai/gpt-oss-120b`, routed by decomposition risk (9 of 15 rows).

**Experiment A — on a pipeline with 0% silent error:**

| | Without critic | With critic |
|---|---|---|
| Silent error | 0% | 0% |
| Autonomy | 50.0% | **26.7%** |
| Queue noise | 0% | **31.8%** |

It degraded 7 of 8 correct lines. And a domain-level mistake: it flagged "material=ZN missing," when
`ZN` is a **finish**, not a material.

**Experiment B — on `gpt-5.4-mini`'s output, with 7 known real errors:**

| | Lines | |
|---|---|---|
| Hits | `1.3`, `5.3` | 2 |
| False positives | `2.1`, `7.1`, `7.2`, `9.1` | 4 |
| Missed | `1.1`, `1.2`, `5.1`, `5.2`, `12.1` | 5 |

**Recall 29% · Precision 33%.**

**The concept works; the implementation doesn't get there.** The two hits are exactly the ones only
this component can catch: the washer with no grade that `mini` put a **standard** (`ASTM F436`) into
the grade field. The span verifier doesn't catch it because the value really is in the text: the
failure is one of **attribution**, not invention.

The blocker isn't the low recall, it's the **31.8% noise**: the brief warns that a noisy queue is
one the buyer stops looking at, and that destroys the whole protection.

**Plan with a stopping criterion**: tighten the prompt → if precision doesn't exceed 70%, change the
model for the `critic` tier → if that still fails, remove it and document it in `08-not-done.md`.

**Why the critic is the place for the cheap model**: it can only ever degrade, so disagreeing
without cause adds a review (cheap error) and agreeing when it shouldn't leaves the line as it was
(nothing gained, nothing lost). A component whose worst case is "no better than not having it"
doesn't need the expensive model.

---

## 5-bis. The synthetic set separates what gold couldn't · 2026-08-22

The four models tied on the gold's 30 lines stop being tied on the 64 rows aimed at catalog gaps.
This was the prediction in §6.2, and it holds.

### Split fidelity on the multi-element rows of the synthetic set

| Row | Design | `gpt-oss-120b` | `kimi-k3` |
|---|---|---|---|
| 35 · bolt + nut + 2 washers, HDG finish | 3 | **3** ✔ | **3** ✔ |
| 62 · stud bolt 1:2:4 with ASTM grades | 3 | **3** ✔ | 1 ✖ |
| 63 · three distinct grade groups (G5/G9/G13) | 3 | 1 ✖ | 1 ✖ |
| 64 · bare secondary (`with NUT`) | 2 | **2** ✔ | 1 ✖ |
| **Total lines** | **71** | **69** | 66 |

**`gpt-oss-120b` gets 3 of 4 right and `kimi-k3` gets 1 of 4**, with `gpt-oss-120b` costing 88×
less on output. On the gold they were indistinguishable; here the cheap one is clearly better. It's
the strongest argument we have for not choosing a model by price or by reputation.

**Row 63 is failed by both.** It's the hardest in the set by design, and has a quirk none of the
others do: it lists the elements as a **comma-separated series** (`Set: bolt …, nut …, 2 washers
…`) instead of with a connector (`with`, `con`, `W/2`, `c/w`). Every example in the prompt uses a
connector. This is a concrete prompt-improvement target, not a model limitation.

### Two bugs that only showed up here

Neither was caught by 88 tests nor by the 8 models evaluated on gold.

**Rows that silently disappeared.** With 0 elements extracted and `outOfFamily=false`,
`validateRow` returned `[]` and **the row vanished**: no line, no reason, nothing to review. It's
the worst possible outcome for the system —worse than extracting badly, because nobody knows they
need to go look for it— and it contradicted the principle already written for the provider-failure
case. It now comes out as `NO_ELEMENTS_EXTRACTED`.

**Escaped quotes read as hallucination.** The evidence came back with the inch mark escaped
literally (`7/8\"`), `locate()` couldn't find it in the text, and **the element was discarded**. It
affects all imperial fasteners. The span verifier, designed to detect invention, was destroying
correct extractions.

With the fix, the synthetic set's lines went from 65 to 69.

### And a methodological error of my own

I nearly concluded that `gpt-oss-120b` split sets worse than `gpt-5.5`, comparing 65
lines against 71. **The 71 were measured with an earlier prompt**: changing it changed the cache
key, so they weren't the same measurement. The cache is what makes measurements cheap and also what
makes it easy to compare apples to oranges without noticing. Every model comparison requires an
identical prompt and identical provider, or it doesn't count.

## 6. Limitations of these measurements

Stated before anyone else states them.

**1. Harness alignment artifact.** The 0% silent error for `deepseek-v4-pro` and
`qwen3.8-max` **is not comparable** to `gpt-5.5`'s. When the split fails, the lines don't align with
gold and the harness compares fewer lines: a model that can't split sets correctly ends up with a
**favorably** low silent error rate. Below 100% split, the figure isn't reliable.

**2. Sample size.** 30 lines. Enough to **rule out** —the four models that break sets are excluded
without debate— and not enough to **distinguish** among the four that score 0%.

**3. Shared blind spot.** I wrote both the gold **and** the prompt. An error shared by both isn't
caught by this measurement. What mitigates it is the 64 targeted synthetic rows —built from the
coverage gaps, not from the MTO— and the blind set from session day.

**4. The prompt is tuned on `gpt-5.5`.** The comparison measures "model X with a 5.5 prompt," not
model X's capability. For the ones that fail, tightening the prompt is a pending experiment.

**5. No repetitions on the open models.** A single run per model, except `gpt-5.5`. Given the 9×
variance factor in latency, the timing figures are indicative only.

---

## 6-bis. Policy gaps · the mechanism behind the rules

`npm run gaps`. Deterministic, cost 0, runs on all rows.

| File | Rows | Gaps | Rows with a gap |
|---|---|---|---|
| Given MTO | 15 | **0** | 0% |
| Targeted synthetic set | 64 | **6** | 5% (3 rows) |

Zero on the known MTO is expected: the policies were written against that file. The 6 in the
synthetic set are all real, with no false positives:

| Gap | Row | What it uncovers |
|---|---|---|
| `UNPLACED_EVIDENCE` name + standard + finish | 36 | The row (`ASME B18.2.1`) produced no elements: **everything it states is left unplaced**. Detected from a different angle than `NO_ELEMENTS_EXTRACTED` |
| `UNPLACED_EVIDENCE` standard `ISO 7050` | 43 | `DIN 7982 C-H` normalizes fine and no line carries it |
| `UNKNOWN_VALUE` grade `45H` | 49 | §5 would resolve it as-is; that rule was written with ASTM grades in mind |
| `UNCOVERED_DERIVATION` material | 49 | No vocabulary entry covers `45H`, so the line was coming out **with no material and silently** |

**On its first run it found a standards-parser bug** nobody had seen: in
`2 nuts DIN 934 and 2 washers` (Spanish: `2 tuercas DIN 934 y 2 arandelas`), the Spanish conjunction
*"y"* got swallowed as a suffix, producing `DIN 934 Y`. Invisible to 88 tests because the
mis-parsed standard still looked like a standard; the gap detected it when it stopped matching
anything carrying a line.

## 7. File-format robustness

10 variants with the **same 15 logical rows** and different Excel shapes, because the brief states
that every study writes it differently. Deterministic, cost 0. `npm run variants`, and included in
`npm test` as a regression.

| Variant | What it targets | Result |
|---|---|---|
| `v01-control` | reference | ✔ |
| `v02-ingles-otro-orden` | column order, quantity not last | ✔ |
| `v03-qty-apostrofo` | `Q'TY`, no `ITEM` column | ✔ **after fix** |
| `v04-sin-cantidad` | total absence of quantity | ✔ warns at file level |
| `v05-descripcion-partida` | description split across two columns | ✔ |
| `v06-columnas-ruido` | `PROYECTO`/`WBS`/`REV`/`PESO` mixed in | ✔ |
| `v07-titulo-largo` | 5 rows of title block + a blank column | ✔ **after fix** |
| `v08-segunda-hoja` | data on the 2nd sheet | ✔ ignores it and reports the cover sheet |
| `v09-tipos-sucios` | quantities as text (`40,00`) | ✔ |
| `v10-frances` | headers in French | ✔ |

### Two bugs that only appear with a different format

**Sparse array.** ExcelJS returns `row.values` sparse, and `Array.prototype.map` **preserves the
gaps**: it skips them. With a blank column before the headers, the `text === null` guard let an
`undefined.trim()` through and **ingestion crashed entirely**. No row of the given MTO triggers it.

**`Q'TY` not recognized.** One of the most common spellings in piping MTOs, and the apostrophe broke
the regex: **the quantity for all 15 rows was lost**. Headers are now compared in folded form (no
diacritics, no punctuation).

### A product change that came out of this

An unrecognized quantity header produced **30 lines with the same reason**,
`QUANTITY_NOT_STATED`: a configuration problem disguised as thirty data problems, which is exactly
how a queue fills up with noise. It's now reported **once, at file level, with the candidate
columns**, so a human can fix it once.

---

## 8. Not yet measured

- [ ] Full pipeline over the format variants (so far only ingestion).
- [ ] The 64 targeted synthetic rows against the four finalists: it's the only thing that can
      distinguish them, because that's where the 12 planted tests and the coverage gaps live.
- [ ] Critic with the tightened prompt.
- [ ] Second blind pass of the gold set → bound on the human error rate.
- [ ] Latency repetitions on the open models.

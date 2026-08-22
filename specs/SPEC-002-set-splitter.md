# SPEC-002 · Set segmenter

| | |
|---|---|
| **File** | `src/pipeline/analyze.ts` (unified with SPEC-003) |
| **Stage** | 2 |
| **LLM** | **Yes** — strict structured output |
| **Status** | ✅ implemented · split fidelity 100% on the 15 rows and on the 64 synthetic ones |
| **Policies** | P-2 (multiplicity) |

## Purpose

Decide how many materials a row describes and isolate the text fragment that corresponds to each
one. **This is the stage the case statement calls "the rule that costs the most".**

## Unified with SPEC-003, and why

The implementation merges this stage with attribute extraction into **a single call per row**.
Deciding that a row contains three materials, and deciding that `ASTM A194, GR 2H` belongs to the
nut and not the stud, is the same act of reading. Kept separate, the extractor would still have to
reread the whole row anyway to place the attributes, so the calls would cost ~3× (one per element
instead of one per row) for the same judgment, and it would add a failure mode: a bad
decomposition that the second stage can't review.

What's preserved from having two specs is the ablation: the deterministic tables in `src/rules`
serve as "split without a model," and the critic (SPEC-006) reviews the decomposition afterward.

## Model routing

The risk that needs the strong model is **attribution** —placing an attribute on the wrong
element— and that risk only exists when the row describes more than one material. `routeRow()`
counts distinct catalog names using the deterministic tables: **deciding which model to call
costs no calls at all**. On the given MTO it classifies 9 rows as multi-element and 6 as simple,
which is exactly the structure of the gold set.

Its only failure mode —a set written with a single recognizable name— is covered by escalation: if
the cheap model returns more than one element on a row that the router judged simple, it is
retried with the strong one.

## Why an LLM

A table would need to enumerate the ways of writing a set (`W/2 HEX. NUT`, `with NUT`,
`c/w NUT AND WASHER`, `con tuerca y arandela`, `Conjunto esparrago ... con 2 tuercas ... y 2
arandelas`), in two languages and with implicit elements. The blind set will bring forms that are
not in the given MTO, and there a table doesn't generalize.

## Contract

**Input**: `MtoRow`
**Output**: `SetElement[]` — each with `role`, `span`, `multiplicity`, `multiplicitySource`.

**Invariants**
- **Do not complete sets by convention.** If the row describes a stud and doesn't mention nuts,
  the output is **one** element. Written, explicit rule from the case statement.
- Every returned element has a `span` that points to text **actually present** in the row. An
  element without a span is a hallucination and is discarded, with a counter.
- The segmenter **does not extract attributes**. It only delimits. Attributes are SPEC-003.

## Behavior

1. Identify every mention of a catalog material (`TORNILLO`, `TUERCA`, `ARANDELA`,
   `VARILLA ROSCADA`, `ESPARRAGO`) and its alias in any language.
2. Mark one as **principal**: the one the row describes first and in the most detail. It
   determines who the measure is extrapolated from (SPEC-005).
3. Extract the **written** multiplicity (`2 HEX. NUT` → 2; `with NUT` → not written) and mark
   `multiplicitySource: "stated" | "not_stated"`. The derivation belongs to SPEC-005 via P-2.
4. If there is only one material, return one element with multiplicity 1.

## Edge cases

| Case | Behavior |
|---|---|
| `Conjunto esparrago ... con 2 tuercas ... y 2 arandelas` (row 9) | 3 elements, multiplicities 1/2/2, all `stated` |
| `with NUT` (row 2) | 2 elements, the nut with `multiplicitySource: "not_stated"` |
| `STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7` (row 12) | **1** element. No nut is added. |
| `Tuerca hexagonal DIN 934 M16, A4-80` (row 11) | 1 element with `role: TUERCA` as principal |
| `1 WASHER` in a set of 2 nuts (row 5) | Different multiplicities per element: 1/2/1 |
| Mention of a material outside the catalog | Ignored and logged in the report |

## Acceptance criteria

- [x] The 15 rows produce the 30 lines of the gold set (`split_fidelity = 100%`).
- [x] Row 12 produces exactly 1 element (a set is not completed by convention).
- [x] No returned element has a span that doesn't exist in the original text: **0 hallucinations**
      across 15 + 64 rows. Spans are located by searching for the literal evidence, never by
      asking the model for offsets.
- [x] The 64 synthetic rows give 71 lines, including 2 out-of-family and 1 without a description.
- [ ] Stability test with 3 repetitions per row. Pending.

## What happens to the KPI if it's removed

Without it there is no set explosion: ~40% of the output lines disappear and the system delivers
one line per MTO row, which is exactly what purchasing cannot buy from. `split_fidelity` drops to
the fraction of rows that describe a single material (7/15 in the given MTO).

# SPEC-003 · Attribute extractor

| | |
|---|---|
| **File** | `src/pipeline/extract.ts` |
| **Stage** | 3 |
| **LLM** | **Yes** — structured output |
| **Status** | 🚧 |

## Purpose

For each element, extract the seven attributes **exactly as they appear in the MTO**, with textual
evidence, and explicit `null` when they don't appear.

## Why an LLM

The attributes appear in free order, with uncatalogued abbreviations, in two languages and
sometimes split between the description and the `MATERIAL` column. What the LLM does **not** do is
normalize: that's SPEC-004 and it's deterministic.

## Contract

**Input**: `SetElement` + `MtoRow` (full row context).
**Output**: `RawAttributes` — 7 fields, each `{ value: string | null, span, sourceColumn }`.

**Invariants**
- **`null` is a first-class answer.** The written rule is *"an attribute the MTO doesn't write is
  not filled in with the most likely value."* The prompt must reward `null`.
- Every non-null value has a span that literally exists in the row's text. If it doesn't exist,
  it's discarded and counted as a hallucination.
- Nothing is normalized here: `zincado` comes out as `zincado`, not as `CINCADO`.
- Nothing is extrapolated here: measurement extrapolation is SPEC-005.

## Behavior per attribute

| Attribute | What is extracted | Note |
|---|---|---|
| **Name** | The detected term (`STUD BOLT`, `Tuerca autoblocante`) | Normalization to the 5-entry catalog is SPEC-004 |
| **Material** | Only if an actual material appears (`acero`, `STEEL`) | The `MATERIAL` column **almost never** carries it. See P-3 |
| **Quality** | Only if the value is **flagged as quality** | Written rule: *"if it isn't known whether a value is flagged as quality, it isn't extracted."* ASTM grades (`GR B7`, `GR 2H`) are extracted as-is |
| **Measure** | Value + unit (`7/8"`, `M20`) | Imperial and metric are not mixed |
| **Length** | Value + unit if present (`130` with no unit → `value: "130", unit: null`) | The unit decision is SPEC-005 via P-4 |
| **Standard** | `DIN…`, `DIN EN…`, `ISO…`, `ASME…`, `ASTM…`, `MSS SP…` | The standard of the **element** is extracted, not that of the row |
| **Finish** | The detected term (`zinc plated`, `zincado`, `geomet`) | Scope within the set is SPEC-005 via P-1 |

## Edge cases

| Case | Behavior |
|---|---|
| Row 1: the nut carries `ASTM A194, GR 2H` in the description | Assigned to the nut, not to the stud bolt |
| Row 3: `con tuerca y arandela` with no standard or quality of its own | Both elements with `standard: null`, `quality: null` |
| `MATERIAL` column = `ASTM A193 GR B7/A194 GR 2H` | Two standards+grades for two different elements; used as context, not as a row value |
| Row 14: `acero` | It's the only real material in the given MTO. It's extracted |
| `8.8` on a nut (rows 11, 13) | Extracted as-is. The inconsistency is caught by SPEC-005 |

## Acceptance criteria

- [ ] 0 span hallucinations across the 15 rows + the 40–60 synthetic ones.
- [ ] In row 3, the nut and the washer come out with quality `null` (not `A2`).
- [ ] In row 1, the nut's quality is `GR 2H` and not `GR B7`.
- [ ] `acero` in row 14 is extracted as the material.

## What happens to the KPI if it's removed

Replaced by a regex baseline, it resolves the rows with a regular format (10, 11, 13, 14, 15) and
falls apart on free-form prose. It's the ablation that quantifies the LLM's real value on this
problem — the number that answers the criterion "know when an agent isn't needed." Measured:
_pending_.

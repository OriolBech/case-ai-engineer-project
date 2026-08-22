# SPEC-003 · Attribute extractor

| | |
|---|---|
| **File** | `src/pipeline/analyze.ts` (unified with SPEC-002) |
| **Stage** | 3 |
| **LLM** | **Yes** — strict structured output |
| **Status** | ✅ implemented · 210/210 cells correct with `gpt-5.5` |

## Purpose

For each element, extract the seven attributes **exactly as they appear in the MTO**, with the
textual evidence, and an explicit `null` when they don't appear.

## Why an LLM

The attributes come in free order, with uncatalogued abbreviations, in two languages, and
sometimes split between the description and the `MATERIAL` column. What the LLM **doesn't** do is
normalize: that's SPEC-004 and it's deterministic.

## Contract

**Input**: `SetElement` + `MtoRow` (full row context).
**Output**: `RawAttributes` — 7 fields, each `{ value: string | null, span, sourceColumn }`.

**Invariants**
- **`null` is a first-class answer.** The written rule is *"an attribute the MTO doesn't write is
  not filled in with the most likely value"*. The prompt must reward `null`.
- Every non-null value has a span that literally exists in the row's text. If it doesn't exist,
  it's discarded and counted as a hallucination.
- Nothing is normalized here: `zincado` comes out as `zincado`, not as `CINCADO`.
- Nothing is extrapolated here: size extrapolation is SPEC-005.

## Behavior by attribute

| Attribute | What gets extracted | Note |
|---|---|---|
| **Name** | The detected term (`STUD BOLT`, `Tuerca autoblocante`) | Normalization to the catalog of 5 is SPEC-004 |
| **Material** | Only if an actual material appears (`acero`, `STEEL`) | The `MATERIAL` column **almost never** carries it. See P-3 |
| **Quality** | Only if the value is **marked as a quality grade** | Written rule: *"if it's unknown whether a value is marked as a quality grade, it isn't extracted"*. ASTM grades (`GR B7`, `GR 2H`) are extracted as-is |
| **Size** | Value + unit (`7/8"`, `M20`) | Imperial and metric aren't mixed |
| **Length** | Value + unit if present (`130` with no unit → `value: "130", unit: null`) | The unit decision is SPEC-005 via P-4 |
| **Standard** | `DIN…`, `DIN EN…`, `ISO…`, `ASME…`, `ASTM…`, `MSS SP…` | The standard is extracted per **element**, not per row |
| **Finish** | The detected term (`zinc plated`, `zincado`, `geomet`) | Scope within the set is SPEC-005 via P-1 |

## Edge cases

| Case | Behavior |
|---|---|
| Row 1: the nut carries `ASTM A194, GR 2H` in the description | Assigned to the nut, not to the stud bolt |
| Row 3: `con tuerca y arandela` (with nut and washer) with no standard or quality of its own | Both elements with `standard: null`, `quality: null` |
| `MATERIAL` column = `ASTM A193 GR B7/A194 GR 2H` | Two standards+grades for two different elements; used as context, not as a row-level value |
| Row 14: `acero` (steel) | It's the only real material in the given MTO. It's extracted |
| `8.8` on a nut (rows 11, 13) | Extracted as-is. The inconsistency is caught by SPEC-005 |

## Acceptance criteria

- [x] 0 span hallucinations across the 15 rows + the 64 synthetic ones.
- [x] In row 3, the nut and washer come out with quality `null` (not `A2`).
- [x] In row 1, the nut's quality is `GR 2H`, not `GR B7`.
- [x] `acero` (steel) in row 14 is extracted as material, and `A2`/`A4` are **not**: they are
      quality grades (§5).
- [x] In row 1 the nut's size is extracted (`HEX. NUT 7/8"` writes it), and in row 5 it is
      extrapolated (`2 NUT ASTM A194`, no size given). The distinction is respected.

## Two prompt errors that cost a round trip

1. **`A2`/`A4` as material.** The prompt gave `A4` as an example of material. They are quality
   grades (G1/G3) and §5 lists them as such. The same error was in the materials table.
2. **Standard placed in the quality field.** `gpt-5.4-mini` returned `ASTM F436` as the washer's
   quality in rows 1 and 5 — where the gold says there is no quality and the line goes to review.
   The span verifier **doesn't catch this**, because `ASTM F436` really is in the text: the
   failure is one of attribution, not invention. It's the gap that justifies the critic (SPEC-006).

## What happens to the KPI if it's removed

Replaced by a regex baseline, it resolves the rows with regular formatting (10, 11, 13, 14, 15)
and fails on free-form prose. This is the ablation that quantifies the LLM's real value for this
problem — the number that answers the criterion "you know when an agent isn't needed." Measured:
_pending_.

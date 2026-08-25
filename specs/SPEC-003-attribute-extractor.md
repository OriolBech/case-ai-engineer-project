# SPEC-003 · Attribute extractor

| | |
|---|---|
| **File** | `src/pipeline/analyze.ts` (unified with SPEC-002) |
| **Stage** | 3 |
| **LLM** | **Yes** — strict structured output |
| **Status** | ✅ implemented · 211/211 certain cells with `gpt-oss-120b` (delivered). 210/210 with `gpt-5.5` was over seven cells, before quantity was graded. |

## Purpose

For each element, extract the seven attributes **exactly as they appear in the MTO**, with
textual evidence, and explicit `null` when they don't appear.

## Why an LLM

The attributes come in free order, with uncatalogued abbreviations, in two languages, and
sometimes split between the description and the `MATERIAL` column. What the LLM does **not** do is
normalize: that's SPEC-004 and it's deterministic.

## Contract

**Input**: `SetElement` + `MtoRow` (full row context).
**Output**: `RawAttributes` — 7 fields, each `{ value: string | null, span, sourceColumn }`.

**Invariants**
- **`null` is a first-class answer.** The written rule is *"an attribute the MTO doesn't write is
  not filled in with the most likely value."* The prompt must reward `null`.
- Every non-null value has a span that exists literally in the row's text. If it doesn't exist,
  it's discarded and counted as a hallucination.
- Nothing is normalized here: `zincado` comes out as `zincado`, not as `CINCADO`.
- Nothing is extrapolated here: measure extrapolation is SPEC-005.

## Behavior per attribute

| Attribute | What's extracted | Note |
|---|---|---|
| **Name** | The detected term (`STUD BOLT`, `Tuerca autoblocante`) | Normalizing to the 5-item catalog is SPEC-004 |
| **Material** | Only if a real material appears (`acero`, `STEEL`) | The `MATERIAL` column **almost never** provides it. See P-3 |
| **Quality** | Only if the value is **marked as quality** | Written rule: *"if it's unclear whether a value is marked as quality, it isn't extracted."* ASTM grades (`GR B7`, `GR 2H`) are extracted as-is |
| **Measure** | Value + unit (`7/8"`, `M20`) | Imperial and metric are not mixed |
| **Length** | Value + unit if present (`130` with no unit → `value: "130", unit: null`) | The unit decision is SPEC-005 via P-4 |
| **Standard** | `DIN…`, `DIN EN…`, `ISO…`, `ASME…`, `ASTM…`, `MSS SP…` | The standard extracted is the **element's**, not the row's |
| **Finish** | The detected term (`zinc plated`, `zincado`, `geomet`) | Scope within the set is SPEC-005 via P-1 |

## Edge cases

| Case | Behavior |
|---|---|
| Row 1: the nut carries `ASTM A194, GR 2H` in the description | Assigned to the nut, not the stud bolt |
| Row 3: `con tuerca y arandela` with no standard or quality of its own | Both elements with `norma: null`, `calidad: null` |
| `MATERIAL` column = `ASTM A193 GR B7/A194 GR 2H` | Two standards+grades for two different elements; used as context, not as a row-level value |
| Row 14: `acero` | It's the only real material in the given MTO. It's extracted |
| `8.8` on a nut (rows 11, 13) | Extracted as-is. The inconsistency is caught by SPEC-005 |

## Acceptance criteria

- [x] 0 span hallucinations across the 15 rows + the 64 synthetic ones.
- [x] In row 3, the nut and the washer come out with quality `null` (not `A2`).
- [x] In row 1, the nut's quality is `GR 2H` and not `GR B7`.
- [x] `acero` from row 14 is extracted as material, and `A2`/`A4` are **not**: they are qualities
      (§5).
- [x] In row 1 the nut's measure is extracted (`HEX. NUT 7/8"` writes it) and in row 5 it's
      extrapolated (`2 NUT ASTM A194`, no measure). The distinction is respected.

## Two prompt errors that cost a round trip

1. **`A2`/`A4` as material.** The prompt gave `A4` as a material example. They're qualities
   (G1/G3) and §5 lists them as such. The same error was in the materials table.
2. **Standard placed in the quality field.** `gpt-5.4-mini` returned `ASTM F436` as the washer's
   quality on rows 1 and 5 — where the gold says there's no quality and the line goes to review.
   The span checker **doesn't catch it**, because `ASTM F436` really is in the text: the failure is
   one of attribution, not invention. It's the gap that justifies the critic (SPEC-006).

## What happens to the KPI if removed

Replaced by the deterministic baseline (`src/pipeline/baseline.ts`): splits by `findNames` and
attributes by proximity to the preceding name. It doesn't invent. It's the ablation that
quantifies the LLM's actual value — the number that answers the "know when you don't need an
agent" criterion.

Run with `pnpm run eval -- --ablate=extract`. The harness uses the same normalize → validate →
gold pipeline; the only variable is who read the row. The measured number gets written into
`docs/04-architecture.md` when it's taken; until then the piece **is implemented**, just not the
report.

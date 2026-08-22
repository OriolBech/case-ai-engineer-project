# SPEC-002 · Set segmenter

| | |
|---|---|
| **File** | `src/pipeline/split.ts` |
| **Stage** | 2 |
| **LLM** | **Yes** — structured output |
| **Status** | 🚧 |
| **Policies** | P-2 (multiplicity) |

## Purpose

Decide how many materials a row describes and isolate the text fragment that corresponds to each
one. **This is the stage the case statement calls "the rule that costs the most".**

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

- [ ] The 15 rows produce the number of elements in the gold set (`split_fidelity = 100%`).
- [ ] Row 12 produces exactly 1 element.
- [ ] No returned element has a span that doesn't exist in the original text.
- [ ] Rerunning the same row 3 times gives the same number of elements (stability test).

## What happens to the KPI if it's removed

Without it there is no set explosion: ~40% of the output lines disappear and the system delivers
one line per MTO row, which is exactly what purchasing cannot buy from. `split_fidelity` drops to
the fraction of rows that describe a single material (7/15 in the given MTO).

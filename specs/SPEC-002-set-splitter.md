# SPEC-002 · Set segmenter

| | |
|---|---|
| **File** | `src/pipeline/analyze.ts` (unified with SPEC-003) |
| **Stage** | 2 |
| **LLM** | **Yes** — strict structured output |
| **Status** | ✅ implemented · split fidelity 100% on the 15 real rows and on the 64 synthetic ones |
| **Policies** | P-2 (multiplicity) |

## Purpose

Decide how many materials a row describes and isolate the text fragment corresponding to each
one. **This is the stage the brief calls "the rule that costs the most."**

## Unified with SPEC-003, and why

The implementation merges this stage with attribute extraction into **a single call per row**.
Deciding that a row describes three materials and deciding that `ASTM A194, GR 2H` belongs to the
nut and not the stud bolt is the same act of reading. Kept separate, the extractor would have to
reread the entire row anyway to place the attributes, so ~3× the calls would be paid (one per
element instead of one per row) for the same judgment, and a failure mode would be added: a bad
decomposition that the second stage can't review.

What's preserved from having two specs is the ablation: the deterministic tables in `src/rules`
act as "split with no model," and the critic (SPEC-006) reviews the decomposition afterward.

## Model routing

The risk that needs the strong model is **attribution** — putting an attribute on the wrong
element — and that risk only exists when the row describes more than one material. `routeRow()`
counts distinct catalog names using the deterministic tables: **deciding which model to call costs
no calls at all**. On the given MTO it classifies 9 rows as multi-element and 6 as simple, which is
exactly the structure of the gold set.

Its only failure mode — a set written with a single recognizable name — is covered by escalation:
if the cheap model returns more than one element on a row the router labeled simple, it's retried
with the strong one.

## Why an LLM

A table would need to enumerate every way of writing a set (`W/2 HEX. NUT`, `with NUT`,
`c/w NUT AND WASHER`, `con tuerca y arandela`, `Conjunto esparrago ... con 2 tuercas ... y 2
arandelas`), in two languages and with implicit elements. The blind set will bring forms that
aren't in the given MTO, and there a table doesn't generalize.

## Contract

**Input**: `MtoRow`
**Output**: `SetElement[]` — each with `role`, `span`, `multiplicity`, `multiplicitySource`.

**Invariants**
- **Don't complete sets by convention.** If the row describes a stud bolt and doesn't mention
  nuts, the output is **one** element. An explicit, written rule from the brief.
- Every returned element has a `span` that points to text **actually present** in the row. An
  element with no span is a hallucination and is discarded with a counter.
- The segmenter **doesn't extract attributes**. It only delimits. Attributes are SPEC-003.

## Behavior

1. Identify every mention of a catalog material (`TORNILLO`, `TUERCA`, `ARANDELA`,
   `VARILLA ROSCADA`, `ESPARRAGO`) and its alias in any language.
2. Mark one as **primary**: the one the row describes first and in the most detail. Determines
   whose measure gets extrapolated (SPEC-005).
3. Read the **written** multiplicity (`2 HEX. NUT` → 2; `with NUT` → not written) and mark
   `multiplicitySource: "stated" | "not_stated"`. The derivation is SPEC-005 via P-2.
4. If there's only one material, return one element with multiplicity 1.

### Multiplicity is decided by the ROW, not the model · 2026-08-22

It's the only number in the pipeline that **multiplies the order**, and it was the only value that
traveled unverified against the row. `gpt-5.4-mini` carried the quantity column over into the
multiplicity field on two rows: 100 bolts came out as 10,000 and 50 came out as 2,500, both
`RESOLVED`, and the harness scored them as perfect because it wasn't comparing the quantity cell
(SPEC-009).

Now `findMultiplicity` reads it off the row's text. The rule, in one sentence: **a quantity has to
be introduced.** It's not enough for it to be the closest number to the name.

| Form | Result | Why |
|---|---|---|
| `W/2 HEX. NUT` | 2 | the form used by the given MTO; the slash is notation and `HEX.` a qualifier |
| `, 2 WASHER` | 2 | introduced by punctuation |
| `con 2 tuercas`, `y 2 arandelas`, `AND 4 WASHER` | 2 · 2 · 4 | introduced by a connector |
| `with NUT`, `c/w NUT AND WASHER` | not written | no number: P-2 decides, not arithmetic |
| `NUT DIN 934 and WASHER` | not written | **934 is a STANDARD**. Nothing introduces it as a quantity |
| `7/8" WASHER` | not written | a fraction. Same slash as `W/2`, with a digit in front |
| `M12 tuercas` | not written | a measurement. Same digits, with a letter stuck in front |
| `1 \| STUD BOLT` | not written | cell boundary: that 1 is the ITEM column |

The model still returns its own figure, and it's only used to **report the discrepancy**: what the
model said versus what the row says. It's the same boundary as `findNames` over the model's
classification, and as the length inside an ISO designation (SPEC-004): where a closed rule can
decide, the model doesn't get a vote.

## Edge cases

| Case | Behavior |
|---|---|
| `Conjunto esparrago ... con 2 tuercas ... y 2 arandelas` (row 9) | 3 elements, multiplicities 1/2/2, all `stated` |
| `with NUT` (row 2) | 2 elements, the nut with `multiplicitySource: "not_stated"` |
| `STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7` (row 12) | **1** element. No nut added. |
| `Tuerca hexagonal DIN 934 M16, A4-80` (row 11) | 1 element with `role: TUERCA` as primary |
| `1 WASHER` in a set of 2 nuts (row 5) | Different multiplicities per element: 1/2/1 |
| `NUT DIN 934 and WASHER DIN 125` (row 4) | No multiplicity written. **Not** 934 washers |
| Mention of a material outside the catalog | Ignored and logged in the report |

## Acceptance criteria

- [x] The 15 rows produce the 30 lines of the gold set (`split_fidelity = 100%`).
- [x] Row 12 produces exactly 1 element (a set isn't completed by convention).
- [x] No returned element has a span that doesn't exist in the original text: **0
      hallucinations** across 15 + 64 rows. Spans are located by searching for literal evidence,
      never by asking the model for offsets.
- [x] The 64 synthetic rows yield 71 lines, including 2 out-of-family and 1 with no description.
- [x] No multiplicity is applied without the row writing it: verified deterministically over the
      **79 rows** of the two MTOs (real and synthetic), and with the form table above in
      `src/pipeline/__tests__/analyze.test.ts`.
- [ ] Stability test with 3 repetitions per row. Pending.

## What happens to the KPI if removed

Without it there's no set explosion: ~40% of output lines disappear and the system delivers one
line per MTO row, which is exactly what procurement can't buy. `split_fidelity` drops to the
fraction of rows describing a single material (6/15 in the given MTO).

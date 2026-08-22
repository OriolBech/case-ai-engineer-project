# SPEC-007 · Confidence and threshold

| | |
|---|---|
| **File** | `src/lib/confidence.ts` |
| **Stage** | Cross-cutting |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

Score each attribute and each line, to decide what goes through the critic and where the
threshold falls between `RESUELTA` (RESOLVED) and `REVISION_MANUAL` (MANUAL REVIEW). **The case
statement calls this "the most important decision of the case, and it is a business decision, not
a technical one".**

## Why not an LLM

Asking a model for a confidence score is asking it to self-evaluate, and it comes out poorly
calibrated. Here, confidence is derived from the data's **provenance**, which is an observable
fact of the pipeline.

## Scale by provenance

| `provenance` | Score | Meaning |
|---|---|---|
| `exact_catalog` | 1.00 | The value appeared literally and is in the closed catalog |
| `table_normalized` | 0.95 | Alias recognized in one of the client's tables |
| `extracted_uncatalogued` | 0.80 | Marked as quality but outside the list (`GR B7`) |
| `extrapolated` | 0.70 | Measure inherited within the set (written rule) |
| `derived` | 0.55 | Material deduced from the quality (P-3) |
| `inferred` | 0.45 | Multiplicity or length unit assumed (P-2, P-4) |
| `absent` | 0.00 | Not in the MTO |

## Aggregation

The confidence of a line is the **minimum** of its mandatory attributes, not the average: an
average hides one bad attribute behind six good ones, and one bad attribute is enough to buy the
wrong material.

## Threshold

Two cutoffs, not one:

- `< T_review` → `REVISION_MANUAL`.
- `T_review … T_high` → goes through the critic (SPEC-006).
- `> T_high` → direct `RESUELTA`.

**Values and justification**: `docs/02-kpi.md` §4. They are chosen by expected cost —where the
cost of the silent error equals that of tail noise— not by an ROC curve.

## Acceptance criteria

- [ ] The thresholds live in a single place and are configurable without touching code.
- [ ] The eval report includes the curve of `silent_error_rate` and `useful_autonomy` against
      `T_review`, so the chosen point can be defended in the session.

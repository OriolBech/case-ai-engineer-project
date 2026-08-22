# SPEC-007 · Confidence and threshold

| | |
|---|---|
| **File** | `src/lib/confidence.ts` |
| **Stage** | Cross-cutting |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

Score each attribute and each line, to decide what goes through the critic and where the threshold
falls between `RESUELTA` and `REVISION_MANUAL`. **The brief calls this "the most important decision
in the case, and it's a business decision, not a technical one."**

## Why not an LLM

Asking a model for a confidence score is asking it to self-assess, and that comes out poorly
calibrated. Here confidence is derived from the **provenance** of the data, which is an observable
fact of the pipeline.

## Scale by provenance

| `provenance` | Score | Meaning |
|---|---|---|
| `not_applicable` | — | Not applicable: length on a nut or washer (§7). Not included in the aggregation |
| `exact_catalog` | 1.00 | The value appeared literally and is in the closed catalog |
| `extracted` | 0.95 | Literal, but with no closed catalog to check it against: measurement, standard with no equivalence, written-out material |
| `table_normalized` | 0.95 | Alias recognized in a client table |
| `extracted_uncatalogued` | 0.80 | Flagged as quality but outside the list (`GR B7`) |
| `extrapolated` | 0.70 | Measurement inherited within the set (written rule) |
| `derived` | 0.55 | Material inferred from quality (P-3) |
| `inferred` | 0.45 | Multiplicity or length unit assumed (P-2, P-4) |
| `absent` | 0.00 | Not in the MTO |

## Aggregation

The confidence of a line is the **minimum** of its required attributes, not the average: an average
hides one bad attribute behind six good ones, and one bad one is enough to purchase the wrong
material.

## Threshold

Two cuts, not one:

- `< T_review` → `REVISION_MANUAL`.
- `T_review … T_high` → goes through the critic (SPEC-006).
- `> T_high` → directly `RESUELTA`.

**Values and justification**: `docs/02-kpi.md` §4. Chosen by expected cost —where the cost of a
silent error equals the cost of tail noise— not by an ROC curve.

## Acceptance criteria

- [ ] The thresholds live in a single place and are configurable without touching code.
- [ ] The eval report includes the `silent_error_rate` and `useful_autonomy` curves against
      `T_review`, so the chosen point can be defended in the session.

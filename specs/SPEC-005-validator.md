# SPEC-005 · Validator and rules engine

| | |
|---|---|
| **File** | `src/pipeline/validate.ts` |
| **Stage** | 5 |
| **LLM** | **No** |
| **Status** | 🚧 |
| **Policies** | P-1 … P-12 |

## Purpose

Apply required-field checks, extrapolations, coherence checks, and policies, and decide the
final status of each line with a typed reason.

## Why NOT an LLM

These are boolean rules over already-normalized values. The result also needs to be
reproducible: the challenge asks for the trace of specific rows.

## Contract

**Input**: `NormalizedElement[]` for a single row (the whole set, because extrapolation
needs sibling context).
**Output**: `OutputLine[]` with `status`, `reasons: ReasonCode[]`, `attributes` with `provenance`.

## Behavior

### 1. Size extrapolation (written rule)
If in a set only one element has a size, it is extrapolated to the rest with
`provenance: "extrapolated"`. **This is the only extrapolation the rules provide for.**

**Before extrapolating, P-10 decides what counts as a size.** A bare number — no `M` and no
quote mark — on an element in a row where another element carries a well-formed size is not a
size: §6 only admits inches and metric, and rules out any equivalence between the two. It is
discarded (leaving the discarded value in the trace) and the extrapolation supplies the good one.
Without this, a false size **blocks** extrapolation of the true one, which is how the `M20` on
row 63 was being lost. And P-11 recovers the discarded value as quality if the catalog
recognizes it and it is coherent with the type. Single-element rows are not touched: the
`4.8x25` on a DIN 7981 really is the size.

### 2. Nothing else is extrapolated
In particular quality: a set may carry a bolt with `A4-70` and a nut with `A4-80` (row 7
demonstrates this literally). An element with no quality → review, quality is **not** inherited
from the bolt.

### 3. Required fields
| Attribute | Required |
|---|---|
| Name | Yes, always |
| Size | Yes, always (extrapolatable) |
| Length | Yes, **except** on `TUERCA` (nut) and `ARANDELA` (washer) |
| Quality | Yes → `QUALITY_MISSING` (the only review rule written into the rules) |
| Standard | Per policy P-5 → `STANDARD_MISSING` |
| Material | Per policy P-3 |
| Finish | **No.** Blank is valid |

### 4. Coherence checks
- `8` and `10` only apply to nuts → if they appear on another type: `QUALITY_TYPE_INCOHERENCE`.
- `8.8`, `10.9`, `12.9` on a nut → `QUALITY_TYPE_INCOHERENCE` (P-6). **Never** convert.
- Imperial size with a metric length declared, or vice versa → `UNIT_MISMATCH`.
- Length outside the physically plausible range for the size → `LENGTH_UNIT_IMPLAUSIBLE` (P-4).

### 5. Policies applied here
P-1 finish on a set · P-2 multiplicity · P-3 derived material · P-4 length unit ·
P-5 missing standard · P-6 quality/type incoherence · P-8 HV · P-9 out of family · P-10 bare
size · P-11 discarded value · **P-12 unrecognized finish**. Each one reads its flag and **records
on the line which policy produced it**.

**P-12.** A finish with a `raw` value and no `normalized` value (`finish:unmapped` or
`finish:ambiguous`) applies `POLICY_UNKNOWN_FINISH`. Default `review`: reason
`UNMAPPED_VALUE`, the line is not exported as an RFQ.
`resolve` is the ablation used for the published KPI (the line resolves as if it carried no
finish; the gap stays in the backlog). See SPEC-011.

### 6. Quantities
`quantity = quantityRow × multiplicity`. If `multiplicitySource = "not_stated"`, P-2 applies and
the line is marked `provenance: "inferred"`.

### 7. Final status
`RESUELTA` (resolved) if there are no `reasons` and all required fields are present; otherwise
`REVISION_MANUAL` (manual review) with **all** the reasons, not just the first: the buyer needs
to know how many things need fixing.

### 8. Distinction required by the brief
Each `ReasonCode` is classified as:
- `MISSING_IN_SOURCE` — the MTO doesn't provide the data. **It goes back to engineering**; no model
  fixes it.
- `LOW_CONFIDENCE` — the system isn't sure. A buyer can resolve it just by looking at it.
- `INCOHERENCE` — the row contradicts itself. Also for the buyer: it needs to be decided, not
  asked about.

The front end presents these as distinct queues, because they call for distinct actions.

And a fourth class the brief doesn't ask for, because it never saw it (P-9):
- `OUT_OF_SCOPE` — the row isn't fasteners. There's no missing data and no doubt: **it isn't ours**.
  Engineering has nothing to fix in it, so sending it their way would be noise in the queue that
  can least afford noise. Its own queue, and outside the KPI denominator.

## Acceptance criteria

- [ ] Row 7: bolt `A4-70` and nut `A4-80` resolve with different qualities.
- [ ] Row 3: nut and washer go to review for `QUALITY_MISSING` + `STANDARD_MISSING`.
- [ ] Rows 11 and 13: nuts with `8.8`/`A4-80` — the `8.8` one flags `QUALITY_TYPE_INCOHERENCE`.
- [ ] Row 12: a single line, `RESUELTA` (with material via P-3).
- [ ] Row 1: the nut and washer get size `7/8"` by extrapolation, marked as such.
- [x] Row 63 of the synthetic set: `10` and `125` are not sizes, they are discarded with their
      trace and both lines get an extrapolated `M20`. The `10` comes back as G9 quality on the
      nut (P-10, P-11).
- [ ] Nuts and washers never go to review for a missing length.
- [ ] Changing any policy flag changes the output and is recorded in the trace.

## What happens to the KPI if this is removed

The `RESUELTA`/`REVISION_MANUAL` distinction disappears: everything comes out resolved and the
silent error becomes the total error. This is the stage that turns the system into something
that can be held accountable.

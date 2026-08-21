# SPEC-005 · Validator and rules engine

| | |
|---|---|
| **File** | `src/pipeline/validate.ts` |
| **Stage** | 5 |
| **LLM** | **No** |
| **Status** | 🚧 |
| **Policies** | P-1 … P-7 (all) |

## Purpose

Apply mandatory-field checks, extrapolations, coherence checks and policies, and decide the final status of
each line with a typed reason.

## Why NOT an LLM

These are boolean rules over already-normalized values. Moreover, the result must be
reproducible: the challenge asks for the trace of specific rows.

## Contract

**Input**: `NormalizedElement[]` from the same row (the complete set, because extrapolation
needs sibling context).
**Output**: `OutputLine[]` with `status`, `reasons: ReasonCode[]`, `attributes` with `provenance`.

## Behavior

### 1. Measure extrapolation (written rule)
If in a set only one element has a measure, it's extrapolated to the rest with
`provenance: "extrapolated"`. **This is the only extrapolation the rules provide for.**

### 2. Nothing else is extrapolated
In particular quality: a set can carry screw `A4-70` and nut `A4-80` (row 7 proves it
literally). Element without quality → review, the screw's quality is **not** inherited.

### 3. Mandatory fields
| Attribute | Mandatory |
|---|---|
| Name | Yes, always |
| Measure | Yes, always (extrapolatable) |
| Length | Yes, **except** for `TUERCA` and `ARANDELA` |
| Quality | Yes → `QUALITY_MISSING` (the only review rule written in the rules) |
| Standard | Per policy P-5 → `STANDARD_MISSING` |
| Material | Per policy P-3 |
| Finish | **No.** Blank is valid |

### 4. Coherence checks
- `8` and `10` only apply to nuts → if they appear on another type: `QUALITY_TYPE_INCOHERENCE`.
- `8.8`, `10.9`, `12.9` on a nut → `QUALITY_TYPE_INCOHERENCE` (P-6). **Never** convert.
- Imperial measure with a declared metric length, or vice versa → `UNIT_MISMATCH`.
- Length outside the physically plausible range for the measure → `LENGTH_UNIT_IMPLAUSIBLE` (P-4).

### 5. Policies applied here
P-1 finish on a set · P-2 multiplicity · P-3 derived material · P-4 length unit ·
P-5 missing standard. Each one reads its flag and **records on the line which policy produced it**.

### 6. Quantities
`quantity = quantityRow × multiplicity`. If `multiplicitySource = "not_stated"`, P-2 is applied and
`provenance: "inferred"` is marked.

### 7. Final status
`RESUELTA` if there are no `reasons` and all mandatory fields are present; otherwise
`REVISION_MANUAL` with **all** the reasons, not just the first: the buyer needs to know
how many things need fixing.

### 8. Distinction required by the brief
Each `ReasonCode` is classified as:
- `MISSING_IN_SOURCE` — the MTO doesn't carry the data. **It goes back to engineering**; no model fixes it.
- `LOW_CONFIDENCE` — the system isn't sure. A buyer can resolve it just by looking at it.

The front end presents these as two distinct queues, because they're two distinct actions.

## Acceptance criteria

- [ ] Row 7: screw `A4-70` and nut `A4-80` are resolved with different qualities.
- [ ] Row 3: nut and washer go to review for `QUALITY_MISSING` + `STANDARD_MISSING`.
- [ ] Rows 11 and 13: nuts with `8.8`/`A4-80` — the `8.8` one flags `QUALITY_TYPE_INCOHERENCE`.
- [ ] Row 12: a single line, `RESUELTA` (with material via P-3).
- [ ] Row 1: the nut and washer receive measure `7/8"` by extrapolation, marked as such.
- [ ] Nuts and washers never go to review for missing length.
- [ ] Changing any policy flag changes the output and is recorded in the trace.

## What happens to the KPI if this is removed

The `RESUELTA`/`REVISION_MANUAL` distinction disappears: everything comes out resolved and the silent
error becomes the total error rate. This is the stage that makes the system something you could bet on.

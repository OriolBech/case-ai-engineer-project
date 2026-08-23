# SPEC-005 · Validator and rules engine

| | |
|---|---|
| **File** | `src/pipeline/validate.ts` |
| **Stage** | 5 |
| **LLM** | **No** |
| **Status** | 🚧 |
| **Policies** | P-1 … P-7 (all) |

## Purpose

Apply mandatory-field checks, extrapolations, coherence checks, and policies, and decide the final
status of each line with a typed reason.

## Why NOT an LLM

These are boolean rules over already-normalized values. The result also has to be
reproducible: in the challenge they ask for the trace of specific rows.

## Contract

**Input**: `NormalizedElement[]` from the same row (the complete set, because extrapolation
needs sibling context).
**Output**: `OutputLine[]` with `status`, `reasons: ReasonCode[]`, `attributes` with `provenance`.

## Behavior

### 1. Size extrapolation (written rule)
If within a set only one element has a size, it is extrapolated to the rest with
`provenance: "extrapolated"`. **This is the only extrapolation the rules allow.**

**Before extrapolating, P-10 decides what counts as a size.** A bare number — without `M` and
without inch marks — on an element in a row where another element carries a well-formed size is not
a size: §6 only allows inches and metric and rules out any equivalence between the two. It is
discarded (leaving the discarded value in the trace) and the extrapolation applies the correct one.
Without this, a false size **blocks** the extrapolation of the true one, which is how the `M20` in
row 63 used to get lost. And P-11 recovers the discarded value as grade if the catalog recognizes it
and it's coherent with the type. Single-element rows are left untouched: the `4.8x25` of a DIN 7981
really is the size.

### 2. Nothing else is extrapolated
Grade in particular: a set can carry an `A4-70` bolt and an `A4-80` nut (row 7 proves it
literally). An element with no grade → review, its grade is **not** inherited from the bolt.

### 3. Mandatory fields
| Attribute | Mandatory |
|---|---|
| Name | Yes, always |
| Size | Yes, always (extrapolatable) |
| Length | Yes, **except** for `TUERCA` and `ARANDELA` |
| Grade | Yes → `QUALITY_MISSING` (the only review rule written into the client's rules) |
| Standard | By policy P-5 → `STANDARD_MISSING` |
| Material | By policy P-3 |
| Finish | **No.** Blank is valid |

### 4. Coherence checks
- `8` and `10` only apply to nuts → if they appear on another type: `QUALITY_TYPE_INCOHERENCE`.
- `8.8`, `10.9`, `12.9` on a nut → `QUALITY_TYPE_INCOHERENCE` (P-6). **Never** convert.
- Imperial size with a declared metric length, or vice versa → `UNIT_MISMATCH`.
- Length outside the physically plausible range for the size → `LENGTH_UNIT_IMPLAUSIBLE` (P-4).

### 5. Policies applied here
P-1 finish across a set · P-2 multiplicity · P-3 derived material · P-4 length unit ·
P-5 missing standard. Each one reads its flag and **records on the line which policy produced it**.

### 6. Quantities
`quantity = quantityRow × multiplicity`. If `multiplicitySource = "not_stated"`, P-2 is applied and
it is marked `provenance: "inferred"`.

### 7. Final status
`RESUELTA` if there are no `reasons` and all mandatory fields are present; otherwise
`REVISION_MANUAL` with **all** the reasons, not just the first: the buyer needs to know how many
things they have to fix.

### 8. Distinction required by the brief
Each `ReasonCode` is classified as:
- `MISSING_IN_SOURCE` — the MTO doesn't carry the data. **Goes back to engineering**; no model fixes it.
- `LOW_CONFIDENCE` — the system isn't sure. A buyer can resolve it by looking at it.
- `INCOHERENCE` — the row contradicts itself. Also the buyer's: it needs a decision, not a question.

The front end presents these as separate queues, because they call for different actions.

And a fourth class the brief doesn't ask for, because it didn't see it (P-9):
- `OUT_OF_SCOPE` — the row isn't fastener hardware. It's neither missing data nor in doubt: it's
  **simply not ours**. Engineering has nothing to fix on it, so sending it over would be noise in
  the queue that can least afford noise. Its own queue, and outside the KPI denominator.

## Acceptance criteria

- [ ] Row 7: `A4-70` bolt and `A4-80` nut resolve with different grades.
- [ ] Row 3: nut and washer go to review for `QUALITY_MISSING` + `STANDARD_MISSING`.
- [ ] Rows 11 and 13: nuts with `8.8`/`A4-80` — the `8.8` one flags `QUALITY_TYPE_INCOHERENCE`.
- [ ] Row 12: a single line, `RESUELTA` (with material via P-3).
- [ ] Row 1: the nut and washer receive the `7/8"` size by extrapolation, flagged as such.
- [x] Synthetic row 63: `10` and `125` are not sizes, discarded with their trace and both lines
      receive the extrapolated `M20`. The `10` comes back as the nut's G9 grade (P-10, P-11).
- [ ] Nuts and washers never go to review for missing length.
- [ ] Changing any policy flag changes the output and is recorded in the trace.

## What happens to the KPI if this is removed

The `RESUELTA`/`REVISION_MANUAL` distinction disappears: everything comes out resolved and the
silent error becomes the total error. This is the stage that turns the system into something you
can actually commit to.

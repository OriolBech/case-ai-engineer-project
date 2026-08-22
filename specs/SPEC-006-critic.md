# SPEC-006 · Critic

| | |
|---|---|
| **File** | `src/pipeline/critic.ts` |
| **Stage** | 6 |
| **LLM** | **Yes** — selective |
| **Status** | 🚧 |

## Purpose

An asymmetric second opinion on lines about to come out as `RESUELTA` (RESOLVED) with weak
evidence. It's the component that buys protection against the costly error.

## Why an LLM

Detecting that the output **contradicts** the original text is comprehension, not field
comparison: a lost set element, a standard assigned to the wrong element, a quantity that doesn't
match the prose. A deterministic validator can't see it because it already validated everything it
knew how to validate.

## Contract

**Input**: `OutputLine[]` for a row + the original `sourceText`.
**Output**: `CriticVerdict[]` — `{ lineId, agrees: boolean, reason?: ReasonCode }`.

**Invariants**
- **It can only degrade.** It never promotes a `REVISION_MANUAL` (MANUAL_REVIEW) to `RESUELTA`
  (RESOLVED). A critic that can promote is a second extractor with less information, and it raises
  the silent error rate.
- **It runs only over a subset**: `RESUELTA` lines with confidence below the high threshold
  (SPEC-007). Running it over everything multiplies cost/row without buying any KPI, and the CFO
  will do the multiplication.
- The prompt is biased toward refuting. When in doubt, `agrees: false`.

## Behavior

1. It's given the original text and the N proposed lines for that row.
2. It checks three things: (a) is any material mentioned in the text missing? (b) is any attribute
   assigned to the wrong element? (c) does any quantity contradict the prose?
3. If it detects something, it returns `agrees: false` with the reason, and the line moves to
   `REVISION_MANUAL` with `reason: CRITIC_DISAGREES` plus the detail.

## Acceptance criteria

- [ ] Never changes a line from `REVISION_MANUAL` to `RESUELTA`. A test verifies this.
- [ ] Runs on ≤30% of the lines in the given MTO (cost control).
- [ ] Lowers `silent_error_rate` in the ablation. If it doesn't lower it measurably, **it's
      removed**: no agent stays if it doesn't buy KPI.

## What happens to the KPI if this is removed

`silent_error_rate` goes up and cost/row goes down. It's an explicit trade-off, and the number
decides whether the component stays. Measured: _pending_.

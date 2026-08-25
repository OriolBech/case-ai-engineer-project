# SPEC-013 · Vocabulary suggestions

| | |
|---|---|
| **Files** | `src/eval/history/suggestions.ts`, `scripts/suggestions-kpi.ts`, `app/components/App.tsx` (applied in-session) |
| **Stage** | Front end + history (outside the pipeline's hot path) |
| **LLM** | No — and it is prohibited as a source |
| **Status** | ✅ module and KPI implemented · 🚧 the front end doesn't persist yet (works in-session) |
| **Related specs** | `SPEC-008` · `SPEC-010` · `SPEC-011` · `SPEC-012` |
| **Policies it applies** | None: a suggestion doesn't resolve on its own |

## Purpose

To give the cheapest path from the safe error (line in review) to the costly error (bad
purchase) — a single click — **its own KPI**, measured separately from the pipeline. If it's
measured with the system's KPI, in three weeks this becomes an auto-resolve button.

## Why not an LLM

A suggestion never comes from a free-form call to the model. Two origins are accepted:

| Origin | What it is |
|---|---|
| `closed_table` | The table already knows the value (catalog §9, derivation P-3) and the click just confirms it |
| `row_evidence` | The value is written in the row itself and the extractor put it in the wrong field |

`free_llm` doesn't exist in the schema. Suggesting what nobody wrote is inventing with a consent
form in front of it, and it's prohibited in the engineering queue (`MISSING_IN_SOURCE`).

## Contract

The front end (`SuggestionPatch`) and persistence share a vocabulary:

```ts
{ attribute: 'finish' | 'material'; match: string; value: string }
```

`match` must appear **literally** in the row. `recordSuggestion` verifies it against
`rowSourceText` (which is not persisted: the client's Excel isn't duplicated).

Lifecycle: `SHOWN → ACCEPTED | REJECTED`; `ACCEPTED → VALIDATED` (the buyer signs off on the
line). The KPI **verification** (`correct | wrong`) is a separate field: the validation click is
not gold.

### The two figures

1. **Acceptance rate** = accepted / decided. Close to 100% → either it should have been a rule, or
   it's being approved without looking. Close to 0% → the suggester is noise. The useful number
   sits in between; that's why it's a KPI, not a target to maximize.
2. **Silent error of accepted suggestions** = wrong / verified. Of what was accepted, how much
   turned out to be incorrect against a subsequent blind check (gold/QA), not against the
   validation click.

With no buyer in front, the KPI reads `0/0`, which is the honest answer: the **shape** of the
measurement is promised, not a value.

```bash
pnpm run suggestions:kpi
```

## Front-end behavior (in-session)

1. Accepting a suggestion re-applies the value to the lines of the open MTO whose `raw` matches.
2. Those lines remain **pending validation** (fail-closed): they don't come out as RESUELTA until a
   person validates them. Saving is deciding; there is no second dialog.
3. The pipeline's raw `result` is **not mutated**. The patch lives only within that session.
4. Today the front end **doesn't call** `recordSuggestion`. The module is ready; wiring it up is a
   POST with the same `{ attribute, match, value }`. Until then, `suggestions:kpi` reports an empty
   queue.

## Invariants

- Not read or written during `processMto`. Capturing is a side effect **outside** the hot path (a
  restriction from `docs/08-not-done.md`).
- A suggestion does not create the vocabulary entry by itself. The addition is `SPEC-012`; the
  suggestion only proposes the session patch and, once persisted, the KPI numerator.
- Attribute scope: only `finish` and `material`, today's UI scope.

## Acceptance criteria

- [x] The schema rejects `attribute` other than `finish`/`material` and `origin` other than
      `closed_table`/`row_evidence`.
- [x] A `match` that doesn't appear literally in the row is not recorded.
- [x] `suggestionKpi()` with an empty queue is 0/0, not 0%.
- [x] Tests in `src/eval/history/__tests__/suggestions.test.ts`.
- [x] The front end applies the patch in-session and leaves the lines pending validation.
- [ ] The front end persists SHOWN/ACCEPTED/REJECTED to the history (wiring pending).

## Test bed

`data/synthetic/MTO_sugerencias.xlsx` (`pnpm run mto:synthetic`) is not a realistic mixed MTO; it
carries `NOMBRE`, `NORMA`, and `ACABADO` columns to exercise **several** vocabularies, not just
finishes. The front end today re-applies `finish` and `material` suggestions live; **quality** is
added from the backlog or `/vocabulario` (SPEC-017) but its effect — coherence and material — is
recalculated on reprocess; name and standard are visible and not editable (SPEC-012).

## Out of scope

- Suggesting name, grade, standard, or size.
- Auto-resolving without a click.
- Fine-tuning / RL from accepted suggestions (`docs/08-not-done.md`).

## What happens to the KPI if this is removed

The pipeline's KPI doesn't move. What's lost is the one figure that tells whether the product's
most dangerous button is training the buyer to click without looking.

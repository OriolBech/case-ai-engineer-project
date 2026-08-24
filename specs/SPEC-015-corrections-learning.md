# SPEC-015 · Supervised learning from buyer corrections

| | |
|---|---|
| **File** | Contract: this spec. Code today: `src/eval/history/corrections.ts` (proposal/approval). E2E promotion and UI: not wired up |
| **Stage** | Outside the hot path of `processMto`. Never read or written during a processing run |
| **LLM** | **No** — and it's forbidden as the origin of the correction and as the promotion engine |
| **Status** | 📋 contract to implement · 🚧 correction model already exists (SPEC-010) |
| **Related specs** | `SPEC-008` · `SPEC-010` · `SPEC-012` · `SPEC-013` · `SPEC-014` |
| **Policies it applies** | None auto-flips. A contradictory correction is a **vocabulary decision**, not a flag |

## Purpose

To make every buyer correction stop being a session patch and become a **label**: who, when, on
what literal evidence, and — only after approval and regression — a new row in the vocabulary
(layer 2) or a gold proposal.

That's what "learning from real corrections" means. It's not RL, it's not retraining, it's not the
system promoting its own predictions. The permitted loop is already written in SPEC-010:

```
execution → human review → PENDING correction → APPROVED → candidate → regression → PROMOTED
```

This spec closes what SPEC-010 leaves half-done: **promotion destination by attribute**,
**conflict between two buyers**, **its own KPI** (SPEC-013's isn't enough: it measures
suggestions, not corrections), and **the human error bound** that the brief says no one has
measured.

## Why not an LLM, and why not RL

- A correction is a fact: "on this row, this span, this author, this value." A model that
  generalizes to the next row is inventing policy.
- RL over bidirectional corrections breaks the critic's asymmetry (SPEC-006: it only downgrades).
  The buyer also *promotes*. Learning weights from that reintroduces the costly error through the
  back door (`docs/08-not-done.md`).
- The buyer is not gold. They correct in a hurry. Two buyers don't normalize the same way — that's
  criterion 4 of the case, not a bug. Promoting the average of the two hides the rule the client
  never wrote down.
- Traceability: SPEC-005 rejects the LLM in the validator because the result would stop being
  reproducible. A model that changes with every click has the same problem, worse.

The piece that **does** learn, and is already half-built, is a **table**: a new alias in
`vocabulary-db` / `finish-db` with who / when / why. Cost ~0, auditable, without touching the hot
path.

## What exists today vs what's missing

| Piece | Status |
|---|---|
| `proposeCorrection` requires a reason and **literal** evidence in the row; author optional | done (SPEC-010) |
| Two contradictory corrections on the same cell both stay `PENDING` | done (test) |
| Detection of a value conflict as a vocabulary decision | done (`listValueConflicts`) |
| Writing from the buyer's queue to `human_corrections` | done (`POST /api/corrections`) |
| Corrections KPI | done (`pnpm corrections:kpi`) |
| Promotion orchestrator (`orchestratePromotion`) | done (requires explicit eval) |
| Promotion to `material` and `finish` vocabulary if regression passes | contract in code; CLI `corrections:promote` |
| The front end applies suggestions **in-session** and doesn't call `recordSuggestion` | SPEC-013 🚧 |
| Promotion destination for name / quality / standard (layer-2 alias) | classified; write path not wired up |
| Second blind pass of the gold set (`pass-2.jsonl`) | pending |

## Contract

### Command (the one that needs implementing)

```ts
interface CorrectionEvent {
  projectId: string | null;
  rowRef: string;
  lineId: string | null;
  attribute: 'name' | 'material' | 'quality' | 'measure' | 'length' | 'standard' | 'finish' | 'quantity';
  previousValue: string | null;
  correctedValue: string | null;
  evidence: string;       // literal substring from the row
  author: string;         // buyer identity, not "system"
  rationale: string;
  at: string;             // ISO
}

type PromotionTarget =
  | { kind: 'vocab_alias'; layer: 2; attribute: 'material' | 'finish' | 'name' | 'quality' | 'standard' }
  | { kind: 'gold_proposal'; cell: string }
  | { kind: 'policy_decision'; policyId: string }
  | { kind: 'not_promotable'; why: 'grammar' | 'missing_in_source' | 'conflict' };
```

### Destination by attribute (the boundary SPEC-012 already defends)

| Attribute | Promoted to a table? | Destination |
|---|---|---|
| `finish`, `material` | Yes, layer 2 | Alias in SQLite + git log. Already designed |
| `name`, `quality`, `standard` | Yes, layer 2, **with ambiguity guard** | Don't mix with the client's catalog (layer 1, read-only) |
| `measure`, `length` | **No** | They're grammar, not vocabulary. The correction can propose gold; not an alias row |
| `quantity` | **No** to vocabulary | Gold or extractor bug. Never an alias |
| `MISSING_IN_SOURCE` cell | **No** | Engineering. Promoting here means inventing data the MTO doesn't carry |

### Value conflict (criterion 4, in code)

No login required. Two corrections with **different values** on the same
`(rowRef, attribute, evidence)` are proof that the client never wrote the rule down.

```ts
interface ValueConflict {
  rowRef: string;
  attribute: string;
  evidence: string;
  values: Array<{ value: string | null; at: string; correctionId: string }>;
  status: 'UNRESOLVED';
}
```

Rules:

1. Two `PENDING`/`APPROVED` corrections on the same `(rowRef, attribute, evidence)` with different
   `correctedValue` are neither averaged, nor voted on, nor is either one promoted.
2. The conflict **leaves the precision channel** and enters the **vocabulary decisions** channel
   (the same backlog as policy gaps, SPEC-012 / `pnpm run gaps`). Recipient: whoever writes the
   client's rule, not the model.
3. Resolving the conflict is an explicit action: pick a value, write down the client's reason, and
   **reject** the other correction. A trail of both is kept.
4. The corrections KPI counts `conflicts / decided`. Close to 0% → the client has rules. Close to
   50% → a single gold is a fiction; the second blind pass will confirm it.

### Human error bound (what the case asks us to assume)

No one has measured the client's human error rate. It isn't asked. It's **bounded** with what we
do control:

| Signal | What it is | Where |
|---|---|---|
| Second blind pass of the gold set | Labeler self-consistency | `data/gold/pass-2.jsonl` — **pending** |
| Value conflicts in production | Same cell, two values | This spec, once there's UI |
| Corrections on `C` (certain) cells | The buyer contradicts a written rule | Bad gold / bad rule / buyer error. All three fit; none is assumed |

None of the three promotes on its own. The first is the one that closes *this* delivery's KPI if
done before the session. The other two belong to the system in production.

### Promotion orchestration (the piece missing in code)

```
APPROVED
  → classifyPromotionTarget(correction)
      → not_promotable / conflict     → stop, visible in the backlog
      → vocab_alias                   → write candidate row (not live)
      → gold_proposal                 → patch file in a branch, not main
  → pnpm run eval -- --save           → silent_error must not rise on C cells
  → if pass: flip alias live / merge gold; status = PROMOTED
  → if fail: stay APPROVED; do not revert the human approval
```

`promoteCorrection` already requires `regressionPassed: true`. What's missing is who runs the eval
and against which dataset: the 30-line gold set **plus** the synthetic one. An alias that fixes the
given MTO and breaks the synthetic one doesn't get promoted.

## Invariants

1. Zero reads of `human_corrections` inside `processMto`.
2. No function exists that creates a correction from a system prediction.
3. There's no authentication. `author` is optional and empty is valid. The conflict is detected by
   **values**, not by accounts.
4. `evidence` has to appear literally in `sourceText` (already enforced).
5. An **accepted** SPEC-013 suggestion is not a correction. It's a session patch. Turning it into a
   correction requires the same `proposeCorrection` (reason, evidence). Otherwise, the suggestions
   KPI and the corrections KPI get contaminated and in three weeks they're the auto-resolve button.
6. Forbidden: embeddings, reward model, few-shot injecting corrections into the analyze prompt
   **on the hot path**. A retrieval of corrected examples, if it ever exists, is a separate cached
   job, not a per-row SELECT in processing (`docs/08-not-done.md`).

## Acceptance criteria (for later implementation)

- [x] The buyer's queue calls `proposeCorrection` when saving an inline edit (vocab patch / validation change).
- [x] A `ValueConflict` appears as a vocabulary decision, not as an extractor error.
- [x] `pnpm run corrections:kpi` reports: pending, approved, promoted, conflicts, and
      `silent_error` of promoted lines vs gold (0/0 until there's a buyer).
- [x] Promotion of `finish`/`material` requires explicit regression (`orchestratePromotion` + CLI).
- [x] Measure and length don't generate a vocabulary row.
- [x] Tests: two values, same span → no `PROMOTED`.

## What happens to the KPI if this is removed

**This delivery's** KPI doesn't change: it's measured against a 30-line hand-labeled gold set.

What's lost is the ability to **know whether the system works on day 30**, once the gold set is no
longer ours. Without this loop, criterion 4 of the case (dirty master data, two buyers, unmeasured
human rate) is answered with an argument and no mechanism. With the loop, the argument has a
detector: the conflicts curve and the promotions-that-survive-regression curve.

If implemented badly (auto-promote, RL, suggestion = correction), the silent-error KPI **drops on
the surface** and rises underneath: the brief's invisible failure, now with a history.

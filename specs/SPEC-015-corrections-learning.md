# SPEC-015 · Supervised learning from buyer corrections

| | |
|---|---|
| **File** | `src/eval/history/corrections.ts`, `src/eval/history/promote.ts`, `app/api/corrections/route.ts`, `app/components/CorrectionQueue.tsx` |
| **Stage** | Outside `processMto`'s hot path. Never read or written during a processing run |
| **LLM** | **No** — and it's forbidden as the source of the correction and as the promotion engine |
| **Status** | ✅ end-to-end flow implemented |
| **Related specs** | `SPEC-008` · `SPEC-010` · `SPEC-012` · `SPEC-013` · `SPEC-014` |
| **Policies it applies** | None self-flips. A contradictory correction is a **vocabulary decision**, not a flag |

## Purpose

To turn every buyer correction from a session-level patch into a **label**: who, when, over what
literal evidence, and — only after approval and regression — a new row in the vocabulary (layer 2)
or a gold proposal.

That's what "learning from actual corrections" means. It's not RL, it's not retraining, it's not
the system promoting its own predictions. The permitted loop is already written in SPEC-010:

```
execution → human review → PENDING correction → APPROVED → candidate → regression → PROMOTED
```

This spec closes what SPEC-010 leaves half-done: **promotion destination by attribute**,
**conflict between two buyers**, **its own KPI** (SPEC-013's isn't enough: it measures
suggestions, not corrections), and **the bound on human error** that the brief says nobody has
measured.

## Why not an LLM, and why not RL

- A correction is a fact: "on this row, this span, this author, this value." A model that
  generalizes to the next row is inventing policy.
- RL on bidirectional corrections breaks the critic's asymmetry (SPEC-006: it only demotes). The
  buyer also *promotes*. Learning weights from that reintroduces the costly error through the back
  door (`docs/08-not-done.md`).
- The buyer isn't gold. Corrections are made in a hurry. Two buyers don't normalize the same way —
  that's criterion 4 of the case, not a bug. Promoting the average of the two hides the rule the
  client never wrote.
- Traceability: SPEC-005 rejects an LLM in the validator because the result would stop being
  reproducible. A model that changes with every click has the same problem, worse.

The piece that **does** learn, and is already half-built, is a **table**: a new alias in
`vocabulary-db` / `finish-db` with who / when / why. Cost ~0, auditable, without touching the hot
path.

## What exists today vs what's missing

| Piece | Status |
|---|---|
| `proposeCorrection` requires a reason and **literal** evidence in the row; author optional | done (SPEC-010) |
| Two contradictory corrections on the same cell both stay `PENDING` | done (test) |
| Value-conflict detection treated as a vocabulary decision | done (`listValueConflicts`) |
| Writing to `human_corrections` | available via API, outside the suggestions' fast flow |
| Corrections KPI | done (`pnpm corrections:kpi`) |
| Open→save time | instrumented in a separate KPI store; target ≤90 s, p50/p90 only with a sample |
| Promotion orchestrator (`orchestratePromotion`) | done (requires an explicit eval) |
| Promotion to `material` and `finish` vocabulary if regression passes | done |
| The front end saves suggestions directly to vocabulary without creating an intermediate correction | SPEC-013 |
| Promotion destination for name / quality / standard (layer-2 alias) | done |
| UI/API queue: list PENDING, approve, reject, conflicts, and confirmed promotion | done; the auditable id is generated server-side |
| Actor and timestamps for every transition + append-only events | done, SQLite schema v2 |
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

### Destination by attribute (the boundary already defended by SPEC-012)

| Attribute | Promoted to a table? | Destination |
|---|---|---|
| `finish`, `material` | Yes, layer 2 | Alias in SQLite + git log. Already designed |
| `name`, `quality`, `standard` | Yes, layer 2, **with an ambiguity guard** | Not mixed with the client's catalog (layer 1, read-only) |
| `measure`, `length` | **No** | These are grammar, not vocabulary. The correction may propose a gold entry; not an alias row |
| `quantity` | **No** to vocabulary | Gold entry or extractor bug. Never an alias |
| `MISSING_IN_SOURCE` cell | **No** | Engineering's problem. Promoting here means inventing data the MTO doesn't provide |

### Value conflict (criterion 4, in code)

No login required. Two corrections with **different values** on the same
`(rowRef, attribute, evidence)` are proof the client never wrote the rule.

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
   `correctedValue`s are neither averaged nor voted on; neither gets promoted.
2. The conflict **leaves the accuracy channel** and enters the **vocabulary decisions** channel
   (the same backlog as the policy gaps, SPEC-012 / `pnpm run gaps`). Recipient: whoever writes
   the client's rule, not the model.
3. Resolving the conflict is an explicit action: pick a value, write the client's stated reason,
   and **reject** the other correction. A trace of both remains.
4. The corrections KPI counts `conflicts / decided`. Close to 0% → the client has rules. Close to
   50% → the single gold set is a fiction; the second blind pass will confirm it.

Name, quality, and standard aliases can only point to a value already recognized by layer 1.
Promoting a new destination would be expanding the client's rule, not learning an alias.

### Bound on human error (what the case asks us to assume)

Nobody has measured the client's human error rate. It isn't asked about. It's **bounded** with
what we do control:

| Signal | What it is | Where |
|---|---|---|
| Second blind pass of the gold set | Labeler self-consistency | `data/gold/pass-2.jsonl` — **pending** |
| Value conflicts in production | Same cell, two values | This spec, once there's a UI |
| Corrections on `C` (certain) cells | The buyer contradicts a written rule | Bad gold / bad rule / buyer mistake. All three fit; none is assumed |

None of the three promotes on its own. The first is the one that closes *this* delivery's KPI if
it's done before the session. The other two are the system in production.

### Promotion orchestration

```
APPROVED
  → classifyPromotionTarget(correction)
      → not_promotable / conflict     → stop, visible in backlog
      → vocab_alias                   → write layer-2 alias
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
4. `evidence` must appear literally in `sourceText` (already enforced).
5. An **accepted** SPEC-013 suggestion is not a correction: it's a direct human vocabulary
   decision. It's not duplicated in `human_corrections`; suggestions and corrections keep separate
   histories and KPIs.
6. Forbidden: embeddings, reward model, few-shot that injects corrections into the analyze prompt
   **on the hot path**. A retrieval of corrected examples, if it ever exists, is a separate,
   cached job, not a per-row `SELECT` during processing (`docs/08-not-done.md`).
7. Time telemetry lives outside `human_corrections`. It records open/save on a best-effort basis
   and never changes the outcome of a decision.

## Acceptance criteria (for the later implementation)

- [x] The buyer queue writes `proposeCorrection` when an inline edit is saved (vocab patch / validation with a change).
- [x] A `ValueConflict` shows up as a vocabulary decision, not as an extractor error.
- [x] `pnpm run corrections:kpi` reports: pending, approved, promoted, conflicts, and
      `silent_error` of the promoted lines vs gold (0/0 until there's a buyer).
- [x] Promotion of the five vocabulary attributes requires an explicit regression run
      (`orchestratePromotion`, API/UI and CLI).
- [x] Measure and length don't generate a vocabulary row.
- [x] Quantity doesn't generate a vocabulary row.
- [x] Tests: two values, same span → no `PROMOTED`.
- [x] Tests: v1→v2 migration, actors/timestamps, promotion of all five families, and actual
      resolution in the deterministic normalizer.

## What happens to the KPI if it's removed

**This delivery's** KPI doesn't move: it's measured against a hand-labeled 30-line gold set.

What's lost is the ability to **know whether the system still works on day 30**, once the gold set
is no longer ours. Without this loop, criterion 4 of the case (dirty master data, two buyers,
unmeasured human error rate) gets answered with an argument and no mechanism. With the loop, the
argument has a detector: the conflict curve and the curve of promotions that survive regression.

If implemented poorly (promoting without a human click, RL, suggestion = correction), the silent
error KPI **appears to drop** and rises on-site: the brief's invisible failure, now with a history.

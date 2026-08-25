# ADR-006 · Agent harness, isomorphic to the evaluation one

- **Date**: 2026-08-24
- **Status**: accepted
- **Case context**: the system already has a harness that governs the extraction LLM
  (SPEC-009). What was missing was the one governing the LLM that maintains the repo.

## Context

This project is developed with a code agent. Without a contract, the agent re-derives
policies that are already measured, edits the gold set to make a test pass, or asserts a
KPI measured against the cache. These are the same failure modes the pipeline already
solves with specs, toggleable policies, and `pnpm run eval`.

Treating the maintenance agent as if it needed no harness contradicts the case's own
evaluation criterion: an LLM only where a table isn't enough, and never without a
contract.

## Decision

A three-layer agent harness, cut along the same lines as the rest of the repo:

| Layer | Role | Pipeline analog |
|---|---|---|
| `AGENTS.md` | Always-loaded contract (what / invariants) | `specs/` |
| `.cursor/rules/` | Conventions scoped by glob | `src/rules/` tables |
| `.cursor/skills/eval-loop` | Measurement procedure, on demand | `pnpm run eval` |

`CLAUDE.md` imports `AGENTS.md`. Instructions aren't duplicated per tool: the contract is
portable (Cursor, Codex, Claude Code). Pending session scratch is not duplicated here;
what's durable stays in this contract.

## Alternatives discarded

| Alternative | Why not |
|---|---|
| `CLAUDE.md` only | Ties the contract to one vendor. The case demonstrates judgment, not loyalty to an IDE. |
| A boilerplate `AGENTS.md` (stack, style, "be helpful") | Doesn't capture the invariants that cost a real error. It's decoration. |
| Putting the eval procedure inside `AGENTS.md` | Bloats every turn's context. The contract fits in the root file; the procedure loads when a measurement is needed. |
| Generic skills (commit, review, PR) | The agent already knows how to do that. What it doesn't know is *this* gold set, *this* cache, *this* rate/count asymmetry. |

## Consequences

**In favor**: the maintenance agent inherits the system's method — measure, don't guess;
nothing implicit; progressive disclosure. An evaluator opening `AGENTS.md` sees the same
criteria as in the pipeline, applied one level up.

**Against**: the contract has to be maintained whenever an invariant changes. The cost is
that of one more spec, and the repo already lives that way.

## How to revert

Delete `AGENTS.md`, `CLAUDE.md`, and `.cursor/`. The pipeline and the evaluation harness
don't depend on them.

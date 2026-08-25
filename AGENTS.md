# AGENTS.md

Contract for the agent that maintains this repo. It's not a README: it's the spec for the
development harness — the same role `specs/` plays for the code.

There are **two harnesses**. Confusing them is the mistake this file exists to prevent:

| Harness | What it controls | Where |
|---|---|---|
| Evaluation (`pnpm run eval`) | The extraction LLM | `src/eval/`, SPEC-009 |
| Agent (this file) | The LLM that edits the repo | `AGENTS.md`, `.cursor/` |

The second exists for the same reason as the first: a model without a contract invents things, and
a number without a baseline lies. Decision: [ADR-006](docs/decisions/ADR-006-agent-harness.md).

What's lasting for the agent harness is here; session scratch stays out of this file.

## Map

| Path | What it is |
|---|---|
| `app/` | The **buyer's** front end (SPEC-008). Not an engineer's UI. |
| `src/pipeline/` | Six stages. LLM only in analyze and critic. LLM-free baseline: `baseline.ts`. |
| `src/rules/` | Tables and engine. **No LLM.** Vocabularies in SQLite + log. |
| `src/eval/` | Evaluation harness and metrics. History: `src/eval/history/`. |
| `specs/` | Contract (the what). If code and spec disagree, one of them is a bug; same commit. |
| `docs/` | The why. Append-only ADRs in `docs/decisions/`. |
| `data/gold/` | Hand-labeled reference. Not edited to make a test pass. |
| `data/input/` | Original case files. Read-only. |
| `.cursor/skills/` | Progressive-disclosure workflows. Load only the one that applies. |
| `.cursor/rules/` | Path-scoped conventions. |

Documentation in English; the 2-pager, the buyer UI, and literal system values stay in Spanish (ADR-001).

## Invariants

Each one cost a real mistake. They're also in code comments.

1. **Only the measurement gets extrapolated.** Not quality, not finish coverage. A row finish
   without an assigned scope goes to review (`FINISH_SCOPE_UNSTATED`).
2. **The table decides the name, not the model.** `findNames` over the literal term rules.
3. **Quality is emitted exactly as written**, never the group representative. `A4-70` ≠ `A4`.
4. **Never convert between quality groups.** `8.8` (G5) is not `8` (G8).
5. **A row never disappears.** 0 elements → `NO_ELEMENTS_EXTRACTED`.
6. **Metrics are computed over CERTAIN cells** in the gold set. Policy-dependent ones are reported
   separately.
7. **Silent error only makes sense read alongside split fidelity.** A model that doesn't split sets
   comes out looking good.
8. **The cache covers only the model call**, never the normalizer or the validator.
9. **Cost and latency are measured with `LLM_CACHE=off`.** Measuring against the cache measures
   the cache.
10. **Comparing models requires an identical prompt and an identical provider.**
11. **Latency needs repetitions.** A single pass isn't a measurement.
12. **A number is asserted with its baseline.** A rate where a count is needed, or a count where a
    rate is needed, is the mistake that has cost the most.

If a behavior isn't in `docs/03-policies.md` or in the client's rules, it's a bug: it doesn't get
resolved implicitly. Every new policy is a switchable `POLICY_*`.

## When to load a skill

| If you're touching… | Load |
|---|---|
| Pipeline, prompt, policy, critic, gold set, or any KPI figure | [eval-loop](.cursor/skills/eval-loop/SKILL.md) |

Don't invent a measurement flow. The one that exists has already failed in the expensive ways;
it's written so as not to repeat them.

## Before claiming a change is done

1. `pnpm run check` — typecheck + tests. Node 26, TypeScript strip-only: relative imports with
   `.ts`, **no** parameter properties, `enum`, or `namespace`.
2. If a component's contract changed: update its `specs/SPEC-*.md` **in the same commit**.
3. If the pipeline or a policy changed: `eval-loop` skill. No number, no closure.
4. Commits: conventional commits, message in English, the body explains the **why**.

## Don't

- Put an LLM inside `src/rules/`. If a table is enough, a table is the answer (the case's
  explicit criterion).
- Rewrite an ADR. Append-only: it gets superseded.
- Edit `data/gold/gold.jsonl` to make an eval pass. The gold set rules; the system adapts or the
  disagreement gets documented.
- Touch `data/input/`.
- Redo `app/` screens without reading SPEC-008, 012, and 013. The user is a buyer.
- Delegate the interpretation of a result that contradicts a previous conclusion. That's where
  judgment is the deliverable.

## Harness compatibility

- Cursor, Codex, Copilot: read this file.
- Claude Code: `CLAUDE.md` imports it. Don't duplicate instructions there.
- Skills: `.cursor/skills/` (progressive disclosure: the contract fits here; the procedure, in the
  skill).
- Path rules: `.cursor/rules/`.

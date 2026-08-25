---
name: eval-loop
description: >-
  Runs and interprets the project's evaluation harness (gold, synthetic, ablations,
  history) after changes to the pipeline, prompt, policy, critic, or gold set. Use when
  changing src/pipeline, src/rules, src/eval, prompts.ts, POLICY_* flags, or when the
  user asks to measure, eval, ablate, compare models, track KPI, gold regression, or
  persist an evaluation run.
---

# Eval loop

This repo's measurement procedure. Don't improvise commands or assert a number without a
baseline: the project's three costly mistakes were measuring only once, comparing different
conditions, and using a rate where a count was needed.

Command matrix: [commands.md](commands.md). Definitions: `docs/02-kpi.md`.
Contract: `specs/SPEC-009-eval-harness.md`. History: `specs/SPEC-010-evaluation-history.md`.

## Loop

Copy and check off:

```
Eval loop:
- [ ] 1. Blast radius
- [ ] 2. Cheap first (`pnpm run check`)
- [ ] 3. Correct harness command
- [ ] 4. Interpret against the invariants
- [ ] 5. Persist only if it's a real measurement
- [ ] 6. Close out spec/docs if the contract changed
```

### 1. Blast radius

| What changed | What to measure |
|---|---|
| Prompt / extract / split | Gold + synthetic. Silent error must stay at 0% in gold if it started at 0. |
| Critic | Gold with and without `--ablate=critic`. Look at the **count** of silent errors and `queue_noise`, not just the rate. |
| `POLICY_*` / `src/rules/` | Gold. The cache must not hide the change (it covers the LLM, not the validator). |
| Ingestion / columns | `pnpm run variants`, then end-to-end eval if the scope calls for it. |
| Vocabulary | `pnpm run rules:audit`. Suggestion KPI separately: `pnpm run suggestions:kpi`. |
| Only tests / types / UI | `pnpm run check`. Don't spend an eval run. |

Don't edit `data/gold/gold.jsonl` to make the eval pass. If the system and the gold disagree,
either fix the system or document the disagreement.

### 2. Cheap first

```bash
pnpm run check
```

If this fails, the eval doesn't run. TypeScript strip-only: see `AGENTS.md`.

### 3. Correct command

See [commands.md](commands.md). Rules not in the table:

- **Cost and latency:** `LLM_CACHE=off`. Measuring against the cache measures the cache (invariant 9).
- **Comparing models:** same prompt, same provider. Otherwise, it isn't a comparison (invariant 10).
- **Latency:** repetitions. A single pass isn't a measurement (invariant 11).
- **Ablation extract:** `pnpm run eval -- --ablate=extract` — reader without an LLM (`src/pipeline/baseline.ts`). It's the deterministic floor, not a competitor to the model.

### 4. Interpret

Read together, never one alone:

1. `silent_error_rate` **and** `silent_error_count` — the rate goes up if the critic removes both bad and good lines; the count says whether that was actually good.
2. `split_fidelity` — alongside the silent error. Without splitting, the harness aligns fewer lines and flatters the model.
3. `useful_autonomy` and `queue_noise` — denominator: lines **of the family** that the **gold** declares, never the system.
4. Attribute breakdown — the brief requires it; the aggregate hides where it fails.
5. `policy_dependent` cells — outside the main metrics.

Before stating a number, write down **what it's being compared against** (last row in `eval/reports/`, an `eval:history` run, or a figure from `docs/10-benchmarks.md`). Without that, don't assert it.

A result that contradicts `docs/05-results.md` or `docs/10-benchmarks.md` **is not delegated**: the judgment is the deliverable.

### 5. Persist

Only runs that will be cited (session, 2-pager, ADR):

```bash
pnpm run eval -- --save --label="short-reason"
pnpm run eval -- --report
```

`--report` dumps to `eval/reports/`. `--save` goes into the SQLite history (SPEC-010), local,
not a versioned decision. For the delta: `pnpm run eval:compare -- <base-run> <candidate-run>`.

Don't fill in `docs/10-benchmarks.md` with a figure whose conditions (cache, prompt, provider,
repetitions) aren't written alongside it.

### 6. Close out

If the component's contract changed, the spec is updated **in the same commit**.
If a new policy showed up, it doesn't live in the code: it lives in `docs/03-policies.md` with
its `POLICY_*`.

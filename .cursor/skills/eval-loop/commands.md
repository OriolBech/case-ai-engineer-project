# Eval loop commands

The harness lives in `scripts/eval.ts`. Node runs TypeScript natively; there's no build step.

## Evaluation

```bash
pnpm run eval                            # gold set, console summary
pnpm run eval -- --report                # report to eval/reports/
pnpm run eval -- --ablate=extract        # deterministic baseline (SPEC-003)
pnpm run traps                           # trap bench (rules, not gold; 0 LLM)
pnpm run eval -- --ablate=critic         # critic turned off
pnpm run eval -- --save --label="…"      # persists to history (SPEC-010)
```

## History and satellite KPIs

```bash
pnpm run eval:history
pnpm run eval:compare -- <base-run> <candidate-run>
pnpm run suggestions:kpi                 # 0/0 without a buyer
pnpm run corrections:kpi
```

## Around, not instead of, the eval

```bash
pnpm run check                           # typecheck + tests
pnpm run rules:audit                     # alias provenance + deterministic baseline
pnpm run variants                        # Excel formats (today: ingestion)
pnpm run variants:eval                   # full pipeline over variants
pnpm run gaps                            # policy gaps
pnpm run cost
pnpm run sweep                           # model sweep
pnpm run providers:check
```

## Conditions that change the number

| Variable | When |
|---|---|
| `LLM_CACHE=off` | Cost, latency, or any figure about to be published |
| Same `LLM_MAIN` / prompt | Comparing models |
| Multiple passes | Latency; also the critic (recall varies between passes) |
| `CRITIC=off` | Equivalent to `--ablate=critic` |

Docker, if there's no local Node:

```bash
docker compose exec app pnpm run eval
```

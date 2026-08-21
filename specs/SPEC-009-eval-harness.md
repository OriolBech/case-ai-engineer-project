# SPEC-009 · Evaluation harness

| | |
|---|---|
| **Files** | `src/eval/` |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

Produce, with a single command, every number the 2-pager and the session require. It has existed
since day 2, because from that point on every change is measured instead of guessed at.

## Contract

```bash
npm run eval                      # gold set, console summary
npm run eval -- --report          # full report to eval/reports/<date>.md
npm run eval -- --set=synthetic   # robustness set
npm run eval -- --ablate=critic   # ablation of one stage
npm run eval -- --sweep-threshold # KPI curve against the threshold
```

## What it measures

Exact definitions in `docs/02-kpi.md`.

1. `silent_error_rate` — primary.
2. `useful_autonomy` — secondary.
3. `split_fidelity` — reported separately, never averaged in.
4. `queue_noise`.
5. **Per-attribute breakdown** of the four above. Required by the brief: *"aggregates hide where
   the system fails."*
6. `€/row` and the extrapolation to `4,000 rows × 25 reviews`.
7. `latency/1,000 lines`.

## Gold set format

`data/gold/gold.jsonl` — one expected output line per record, with:
- the 7 expected attributes,
- `certainty: "certain" | "policy_dependent"` **per cell**,
- the expected reason if it goes to review.

`policy_dependent` cells are excluded from the primary metrics and reported as a sensitivity
analysis. A KPI that mixes both isn't defensible in front of a client.

## Acceptance criteria

- [ ] The report includes the literal list of failed lines, with expected vs. obtained and the
      trace. This is what the brief asks to be shown: *"the rows that fell through."*
- [ ] `--ablate` works for split, extract, normalize, critic.
- [ ] Reproducible: two consecutive runs give the same report except for latency.
- [ ] Runs in < 2 min on the gold set (otherwise it won't get used).

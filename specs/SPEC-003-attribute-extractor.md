# SPEC-009 · Evaluation harness

| | |
|---|---|
| **Files** | `src/eval/` |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

Produce, with a single command, all the numbers the 2-pager and the session require. It has
existed since day 2 because from then on every change is measured instead of guessed at.

## Contract

```bash
pnpm run eval                      # gold set, console summary
pnpm run eval -- --report          # full report to eval/reports/<date>.md
pnpm run eval -- --set=synthetic   # robustness set
pnpm run eval -- --ablate=extract  # deterministic baseline (SPEC-003 · src/pipeline/baseline.ts)
pnpm run eval -- --ablate=critic   # critic turned off
pnpm run eval -- --save            # persists to history (SPEC-010)
pnpm run suggestions:kpi           # suggestions' own KPI (SPEC-013); 0/0 with no buyer
```

## What it measures

Exact definitions in `docs/02-kpi.md`.

1. `silent_error_rate` — primary.
2. `useful_autonomy` — secondary. Denominator: lines **in the family** (see 8).
3. `split_fidelity` — reported separately, never averaged in.
4. `queue_noise`. Same denominator as 2.
5. **Per-attribute breakdown** of the four above. Required by the brief: *"aggregates hide where
   the system fails."*
6. `€/row` and the extrapolation to `4,000 rows × 25 revisions`.
7. `latency/1,000 lines`.
8. `out_of_scope` — P-9, reported separately and never averaged in. Lines the gold declares to
   belong to another family are excluded from the denominators of 2 and 4: counting them would
   make the metric move depending on how many flanges the MTO brings. The exclusion is decided by
   **the gold, never the system**, and the two kinds of disagreement are named separately
   (`missed`, `falsePositives`) because they don't cost the same.

## Gold set format

`data/gold/gold.jsonl` — one expected output line per record, with:
- the 7 expected attributes,
- **the quantity**, which is the eighth gradable cell,
- `certainty: "certain" | "policy_dependent"` **per cell**,
- the expected reason if it goes to review.

`policy_dependent` cells are excluded from the main metrics and reported as a sensitivity
analysis. A KPI that mixes both isn't defensible in front of a client.

**About the quantity.** It isn't one of the seven catalog attributes and isn't included in their
breakdown, but it does count toward the silent error rate: it's the only field where getting it
wrong **multiplies** the order. The gold has labeled it from day one (21 certain cells, 9 policy
cells) and the harness **wasn't comparing it**: the cell loop only iterated over the seven
attributes. A line asking for 10,000 bolts where the MTO asks for 100 came out perfect. Fixed; the
certain-cell denominator goes from 190/210 to **211/240**, and every measurement before that fix was
blind to quantity.

## Acceptance criteria

- [ ] The report includes the literal list of failed lines, with expected vs. obtained and the
      trace. It's what the brief asks to be shown: *"the rows that fell through."*
- [x] `--ablate=extract` and `--ablate=critic` are implemented. split/normalize remain pending.
- [ ] Reproducible: two consecutive runs give the same report except for latency.
- [ ] Runs in < 2 min on the gold set (otherwise it won't get used).

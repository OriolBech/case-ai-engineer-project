# SPEC-009 · Evaluation harness

| | |
|---|---|
| **Files** | `src/eval/` |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

To produce, with a single command, every number the 2-pager and the session require. It's existed
since day 2, because from that point on every change gets measured instead of guessed at.

## Contract

```bash
pnpm run eval                      # gold set, console summary
pnpm run eval -- --report          # full report to eval/reports/<date>.md
pnpm run eval -- --set=synthetic   # robustness set
pnpm run eval -- --ablate=critic   # ablation of one stage
pnpm run eval -- --sweep-threshold # KPI curve against the threshold
```

## What it measures

Exact definitions in `docs/02-kpi.md`.

1. `silent_error_rate` — primary.
2. `useful_autonomy` — secondary. Denominator: lines **belonging to the family** (see 8).
3. `split_fidelity` — reported separately, never averaged in.
4. `queue_noise`. Same denominator as 2.
5. **Per-attribute breakdown** of the four above. Required by the brief: *"los agregados esconden
   dónde falla el sistema"*.
6. `€/row` and the extrapolation to `4,000 rows × 25 reviews`.
7. `latency/1,000 lines`.
8. `out_of_scope` — P-9, reported separately and never averaged in. The lines the gold set
   declares as belonging to another family are excluded from the denominators in 2 and 4:
   counting them would make the metric move with however many flanges the MTO happens to bring.
   That exclusion is decided by **the gold set, never by the system**, and the two kinds of
   disagreement are named separately (`missed`, `falsePositives`) because they don't cost the
   same.

## Gold set format

`data/gold/gold.jsonl` — one expected output line per record, with:
- the 7 expected attributes,
- **the quantity**, which is the eighth gradable cell,
- `certainty: "certain" | "policy_dependent"` **per cell**,
- the expected reason if it goes to review.

`policy_dependent` cells are excluded from the main metrics and reported as a sensitivity
analysis. A KPI that mixes the two isn't defensible in front of a client.

**On quantity.** It isn't one of the seven catalog attributes and doesn't enter the breakdown
alongside them, but it does count toward silent error: it's the only field where getting it wrong
**multiplies** the order. The gold set has labeled it from day one (21 certain cells, 9
policy-dependent), and the harness **wasn't comparing it**: the cell loop only walked the seven
attributes. A line with 10,000 bolts where the MTO asked for 100 came out perfect. Fixed; the
certain-cells denominator goes from 190/210 to **211/240**, and every measurement taken before
that fix was blind to quantity.

## Acceptance criteria

- [ ] The report includes the literal list of failed lines, with expected vs. obtained and the
      trace. This is what the brief asks to be shown: *"las filas que se te han caído"*.
- [ ] `--ablate` works for split, extract, normalize, critic.
- [ ] Reproducible: two consecutive runs produce the same report except for latency.
- [ ] Runs in < 2 min on the gold set (otherwise it doesn't get used).

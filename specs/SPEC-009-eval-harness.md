# SPEC-009 · Evaluation harness

| | |
|---|---|
| **Files** | `src/eval/` |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

To produce, with a single command, all the numbers the 2-pager and the session require. It exists
from day 2 onward, because from that point every change gets measured instead of guessed at.

## Contract

```bash
pnpm run eval                      # gold set, console summary
pnpm run eval -- --report          # full report to eval/reports/<date>.md
pnpm run eval -- --ablate=extract  # deterministic baseline (SPEC-003 · src/pipeline/baseline.ts)
pnpm run eval -- --ablate=critic   # critic turned off
pnpm run eval -- --save            # persists to history (SPEC-010)
pnpm run traps                     # trap-case bank (rule invariants, 0 LLM)
pnpm run suggestions:kpi           # suggestions' own KPI (SPEC-013); 0/0 without a buyer
```

`--set=synthetic` was documented here before it existed: the 64-row set in `data/synthetic/` is
the coverage map, not a second gold set. The executable bank is `pnpm run traps`
(`src/eval/trap-cases.ts`). The synthetic set is not labeled with 7 cells after seeing the system.

## What it measures

Exact definitions in `docs/02-kpi.md`.

1. `silent_error_rate` — primary.
2. `useful_autonomy` — secondary. Denominator: lines **in the family** (see 8).
3. `split_fidelity` — reported separately, never averaged in.
4. `queue_noise`. Same denominator as 2.
5. **Per-attribute breakdown** of all four. Required by the brief: *"aggregates hide where the
   system fails."*
6. `€/row` and the extrapolation to `4,000 rows × 25 reviews`.
7. `latency/1,000 lines`.
8. `trace_fidelity` — **does the system tell the truth about where each datum came from?**
   Reported separately and never folded into 1-5. See below.
9. `out_of_scope` — P-9, reported separately and never averaged in. Lines the gold set declares as
   belonging to a different family are excluded from the denominators of 2 and 4: counting them
   would make the metric swing with how many flanges the MTO happens to contain. The exclusion is
   decided by **the gold set, never the system**, and the two kinds of disagreement are named
   separately (`missed`, `falsePositives`) because they don't cost the same.

### On provenance — the same hole as quantity, one level down

The gold labels the **provenance** of all 240 cells (`GoldCell.provenance`, there since the first
day), and **no metric looked at it**. The story is the one below about quantity, repeated: a field
labelled from the start, never compared, and therefore free to drift. It did — the system disagreed
with the gold on the quantity provenance of 10 of 30 lines, and nothing showed it.

It is not cosmetic. Provenance **decides the line's status**: `THRESHOLD_MIN_PROVENANCE` routes to
review on the weakest link, so a wrong provenance sends a good line to review or — worse — stays
quiet about a value that was assumed. It also drives the ● mark that tells the buyer where to look,
and it orders the risk panel.

`trace_fidelity` = of the CERTAIN cells **whose value already matches**, how many carry the gold's
provenance.

- **Only where the value matches.** The provenance of a wrong value informs nothing, and counting
  it would punish the same failure twice.
- **Never folded into the value rates.** Two reasons. It answers a different question — those say
  *is the datum right*, this says *is what the system claims about the datum right*. And invariant
  12: those numbers are published in `docs/10-benchmarks.md`, and redefining them underneath would
  leave the whole history without a baseline.

**First run: 85.8% (181/211), with one systematic disagreement — `name`, on all 30 lines.** Excluding
`name` it is 181/181, over the same 211 certain cells as every other rate. The gold labels `name` as `extracted` while labelling every other
table-driven attribute (`standard`, `finish`, `quality`) as `table_normalized`, for the same
mechanism. Our reading is that the gold is inconsistent with itself here; it has **not** been
changed, and the disagreement is written up in `data/gold/README.md` for a human to settle. Quote
the number as 85.8% with its exception named — never as 100% by quietly dropping `name`.

## Gold set format

`data/gold/gold.jsonl` — one expected output line per record, with:
- the 7 expected attributes,
- **the quantity**, which is the eighth gradable cell,
- `certainty: "certain" | "policy_dependent"` **per cell**,
- **the provenance** expected for each cell, which `trace_fidelity` grades,
- the expected reason if it goes to review.

`policy_dependent` cells are excluded from the main metrics and reported as a sensitivity
analysis. A KPI that mixes both isn't defensible in front of a client.

**On quantity.** It's not one of the seven catalog attributes and doesn't enter the breakdown
alongside them, but it does count toward silent error: it's the only field where getting it wrong
**multiplies** the order. The gold set has labeled it from day one (21 certain cells, 9
policy-dependent), and the harness **wasn't comparing it**: the cell loop only iterated over the
seven attributes. A line with 10,000 bolts where the MTO asks for 100 came out perfect. Fixed; the
certain-cell denominator goes from 190/210 to **211/240**, and every measurement before this fix
was blind to quantity.

## Acceptance criteria

- [ ] The report includes the literal list of failed lines, with expected vs. obtained and the
      trace. This is what the brief asks to be shown: *"the rows that fell through."*
- [x] `--ablate=extract` and `--ablate=critic` are implemented. split/normalize are still pending.
- [ ] Reproducible: two consecutive runs give the same report except for latency.
- [ ] Runs in < 2 min on the gold set (otherwise it won't get used).
- [x] Every field the gold labels is compared by some metric. Quantity's **value** (2026-08-24) and
      every cell's **provenance** (2026-08-25) were both labelled and both unmeasured; a labelled
      field nobody grades is a field free to drift, and both did.
- [x] `trace_fidelity` is reported apart, persisted to the history, and names its disagreements
      line by line so they can be gone and looked at.

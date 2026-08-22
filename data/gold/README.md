# Gold set

The reference against which we measure. **It is not provided by the case**: building it is the
first decision and takes up half the session's conversation.

| File | What it is |
|---|---|
| [`gold.md`](gold.md) | **Start here.** The 30 lines, row by row, human-readable, with the analysis |
| `gold.jsonl` | Machine format, one output line per record |
| `gold.stats.json` | Aggregated statistics |
| `pass-2.jsonl` | ⬜ Second blind pass (pending) |
| `self-consistency.md` | ⬜ Discrepancies between passes = bound on the human error rate (pending) |

## Summary

15 rows → **30 lines**. **15 resolved (50%) / 15 sent to review (50%)**.
**83%** of the cells are derivable from the rules; **17%** depend on policy.

**87% of the review queue** is a single problem: the MTO does not record the quality of the nuts
and washers in a set. It is `MISSING_IN_SOURCE` — no model can fix that.

## Rules

1. **Labeling before building the system.** If labeled afterward, you end up labeling whatever
   the system already does.
2. **Every cell carries its certainty.** The KPI is calculated on the certain ones; the
   policy-dependent ones are reported as sensitivity. A KPI that mixes both is not defensible.
3. **Regenerable**: `scripts/gold.py` (in the session's scratchpad) produces the three files.
   If a label changes, it is changed there and regenerated, so that `.jsonl` and `.md` don't diverge.

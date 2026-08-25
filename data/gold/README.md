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

## Open disagreement · the provenance of `name` (2026-08-25)

The gold labels the **provenance** of all 240 cells, and until today nothing compared it. The
`trace_fidelity` metric (SPEC-009) now does, and its very first run found exactly one systematic
disagreement — **`name`, on all 30 lines**:

```
fidelidad de traza  85.8%  (181/211)
   1.1.name: extracted -> table_normalized      ... x30
```

Excluding `name`, the agreement is **181/181 — 100%**. So this is one labelling convention, not a
scattering of errors. The denominator is the same 211 certain cells every other rate uses.

**Our reading is that the gold is wrong here, and it is wrong against its own convention.** The name
goes through the §3 table exactly like the other three table-driven attributes, and the gold labels
those `table_normalized`:

| Attribute | Mechanism | Gold says |
|---|---|---|
| `standard` | `DIN 934` → `ISO 4032`, closed §8 table | `table_normalized` (17×) |
| `finish` | `zincado` → `CINCADO`, closed §9 table | `table_normalized` (8×) |
| `quality` | catalogued against §5 | `table_normalized` (12×) |
| **`name`** | **`STUD BOLT` → `ESPARRAGO`, closed §3 table** | **`extracted` (30×)** |

`name` is if anything the *most* table-driven attribute in the system — invariant 2 is literally
*"the table decides the name, not the model"*, and there is a test asserting the table overrides the
model. Labelling it `extracted` says a value the table produced was read verbatim from the row,
which for `STUD BOLT → ESPARRAGO` is not true: that string is not in the row.

**It is NOT being changed here, and that is deliberate.** The gold rules; the system adapts or the
disagreement is documented (`AGENTS.md`). A metric's first run is the worst possible moment to let
the thing being measured rewrite its own reference, and a hand-labelled convention is a human call.
Until it is settled, `trace_fidelity` reads **85.8% with one known systematic exception**, and that
is how it should be quoted — never as 100% by quietly dropping `name`.

To settle it: either regenerate the gold with `name: table_normalized` (and the number becomes
100%), or write down why `name` is different and add the exception to the metric.

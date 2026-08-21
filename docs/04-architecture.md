# Architecture

> Status: 🚧. Feeds section 2 of the 2-pager, which requires for each agent: **what it does, why
> it exists, and what happens to the KPI if you remove it.**

## Pipeline

```
Excel  →  1 ingest  →  2 split  →  3 extract  →  4 normalize  →  5 validate  →  6 critic  →  UI
          (det.)       (LLM)       (LLM)         (det.)          (det.)         (LLM, sel.)
```

## Where there's a model and where there isn't

| Stage | LLM | What a table would do worse here | Spec |
|---|---|---|---|
| 1 · ingest | No | — (it's I/O) | SPEC-001 |
| 2 · split | **Yes** | Segmenting free, multilingual prose with implicit elements: a table would need to enumerate every way of writing a set, and the blind set will bring more. | SPEC-002 |
| 3 · extract | **Yes** | Locating 7 attributes in free order with uncataloged abbreviations and deciding when an attribute *isn't there*. | SPEC-003 |
| 4 · normalize | No | Nothing: these are 4 closed, exhaustive tables. Putting a model here is exactly the judgment error the case penalizes, and it's billed per token. | SPEC-004 |
| 5 · validate | No | Nothing: these are boolean rules. A model here would also make the result non-reproducible, and traceability has to be shown in the challenge. | SPEC-005 |
| 6 · critic | **Yes** | Detecting that the output contradicts the original text — that's comprehension, not comparison. It only runs on weak-evidence lines, and **can only downgrade**. | SPEC-006 |

## Ablations (what happens to the KPI if I remove it)

Measured with `npm run eval -- --ablate=<stage>` on day 4.

| Remove | Expected effect | Measured |
|---|---|---|
| split | Set explosion collapses; ~40% of output lines disappear | _pending_ |
| extract (regex baseline) | Free-prose rows are lost; silent error goes up | _pending_ |
| normalize | Equivalences are lost; attributes come out unnormalized | _pending_ |
| validate | The RESUELTA/REVISION distinction disappears: everything comes out resolved | _pending_ |
| critic | Silent error goes up; cost/row goes down | _pending_ |

**LLM-free baseline.** The 1+4+5 pipeline is measured on its own. It's the number that proves the
"I know when an agent isn't needed" criterion: if the deterministic part already resolves N% of
the attributes, the LLM only has to justify the delta.

## Traceability

A requirement, not an extra: in the challenge they ask for the trace of specific rows. Every
attribute of every output line carries:

- `raw` — the value as it appeared.
- `span` — offsets in the original text of the MTO row.
- `normalized` — the final value.
- `provenance` — `extracted | table_normalized | derived | inferred | extrapolated | absent`.
- `rule` — the identifier of the rule or policy that produced it (`G3`, `DIN934→ISO4032`, `P-1`).

## The deterministic baseline, measured

`npm run rules:audit`, day 0. Zero model calls.

| | Given MTO (15 rows) | Synthetic set (64 rows) |
|---|---|---|
| Rows with detected name | 100% | 95% |
| Rows with detected standard | 93% | 94% |
| Rows with recognizable quality in column | 93% | 95% |
| Rows with detected finish | 53% | 41% |

**How this table should be read, and how it shouldn't.**

The 41% for finish **isn't a failure**: most rows carry no finish, and a blank finish is a valid
value that doesn't go to review (§9). Detecting a finish on 41% of the rows is correct if 41% of
the rows actually carry one.

And more importantly: **these numbers are inflated relative to what the problem actually asks
for.** They measure *"does a name appear in the row?"*, not *"is the row split into the correct
number of lines, with each attribute assigned to the correct element?"*. Row 1 of the MTO contains
three names, three standards, and three qualities: detecting all of them is trivial, and assigning
`ASTM A194` + `GR 2H` to the nut and not to the stud is the entire problem.

That's exactly what a table can't do, and it's what the agents have to earn their keep on. The
honest baseline for `split_fidelity` with tables alone is the fraction of rows describing a single
material: **7 of 15 (47%)** in the given MTO. That's the number the LLM's delta is measured
against.

The three rows in the synthetic set with no detected name are `S56` (a flange), `S57` (a gasket),
and `S58` (empty description). The tables **not** assigning them a catalog name is the correct
behavior: it's policy P-9 already working at the table level.

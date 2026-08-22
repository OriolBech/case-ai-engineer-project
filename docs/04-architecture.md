# Architecture

> Status: 🚧. Feeds section 2 of the 2-pager, which requires, for each agent: **what it does, why
> it exists, and what happens to the KPI if you remove it.**

## Pipeline

```
Excel  →  1 ingest  →  2+3 analyze  →  4 normalize  →  5 validate  →  6 critic  →  UI
          (det.)        (LLM)           (det.)          (det.)         (LLM, sel.)
                          ↑
                    deterministic router
                    (0 model calls)
```

Stages 2 and 3 are **a single call per row**: deciding that a row contains three materials and
deciding that `ASTM A194, GR 2H` belongs to the nut and not the stud bolt is the same act of
reading. Splitting them would cost ~3× the calls for the same judgment and would add a failure
mode — a bad decomposition that the second stage can't review. Details in `specs/SPEC-002`.

## The model router

The risk that needs the strong model is **attribution**: putting an attribute on the wrong
element. That risk **only exists when a row describes more than one material** — a single-element
row has nowhere to go wrong.

`routeRow()` counts distinct catalog names using the deterministic tables in `src/rules`, so
**deciding which model to call costs no call at all**. On the given MTO it classifies 9 rows as
multi-element and 6 as simple, which is exactly the structure of the gold set.

Its only failure mode is a set written with a single recognizable name. It isn't covered by making
the router smarter, but by escalating: if the cheap model returns more than one element for a row
the router considered simple, it's retried with the strong one. Rare by construction, and much
cheaper than sending every row to the strong model just in case.

## Where there's a model and where there isn't

| Stage | LLM | What a table would do worse here | Spec |
|---|---|---|---|
| 1 · ingest | No | — (it's I/O) | SPEC-001 |
| 2 · split | **Yes** | Segmenting free multilingual prose with implicit elements: a table would need to enumerate every way of writing a set, and the blind set will bring more. | SPEC-002 |
| 3 · extract | **Yes** | Locating 7 attributes in free order with uncataloged abbreviations, and deciding when the attribute *isn't present*. | SPEC-003 |
| 4 · normalize | No | Nothing: these are 4 closed, exhaustive tables. Putting a model here is exactly the misjudgment the case penalizes, and it's paid for by the token. | SPEC-004 |
| 5 · validate | No | Nothing: these are boolean rules. A model here would also make the result non-reproducible, and the challenge requires a trace. | SPEC-005 |
| 6 · critic | **Yes** | Detecting that the output contradicts the original text — this is comprehension, not comparison. Runs only on weak-evidence lines, and **can only degrade**. | SPEC-006 |

## Ablations (what happens to the KPI if I remove it)

Measured with `npm run eval -- --ablate=<stage>` on day 4.

| Remove | Expected effect | Measured |
|---|---|---|
| split | Set explosion collapses; ~40% of output lines disappear | _pending_ |
| extract (regex baseline) | Free-prose rows are lost; silent error rises | _pending_ |
| normalize | Equivalences are lost; attributes come out unnormalized | _pending_ |
| validate | The RESUELTA/REVISION_MANUAL distinction disappears: everything comes out resolved | _pending_ |
| critic | Silent error rises; cost/row falls | _pending_ |

**LLM-free baseline.** The 1+4+5 pipeline is measured on its own. It's the number that demonstrates
the criterion "knowing when an agent isn't needed": if the deterministic version already resolves
N% of the attributes, the LLM only has to justify the delta.

## Traceability

A requirement, not an extra: the challenge asks for the trace of specific rows. Every attribute
of every output line carries:

- `raw` — the value as it appeared.
- `span` — offsets in the original text of the MTO row.
- `normalized` — the final value.
- `provenance` — `extracted | table_normalized | derived | inferred | extrapolated | absent`.
- `rule` — the identifier of the rule or policy that produced it (`G3`, `DIN934→ISO4032`, `P-1`).

## The deterministic baseline, measured

`npm run rules:audit`, day 0. Zero model calls.

| | Given MTO (15 rows) | Synthetic set (64 rows) |
|---|---|---|
| Rows with a detected name | 100% | 95% |
| Rows with a detected standard | 93% | 94% |
| Rows with a recognizable quality in the column | 93% | 95% |
| Rows with a detected finish | 53% | 41% |

**How this table should be read, and how it shouldn't.**

The 41% for finish **isn't a failure**: most rows don't carry a finish, and a blank finish is a
valid value that doesn't trigger a review (§9). Detecting a finish in 41% of rows is correct if
41% of rows actually carry a finish.

And more importantly: **these numbers are inflated relative to what the problem actually asks.**
They measure *"does a name appear in the row?"*, not *"is the row split into the correct number of
lines, with each attribute assigned to the right element?"*. Row 1 of the MTO contains three
names, three standards, and three qualities: detecting all of them is trivial, and assigning
`ASTM A194` + `GR 2H` to the nut and not the stud bolt is the whole problem.

That is exactly what a table can't do, and it's what the agents have to earn their keep on. The
honest baseline for `split_fidelity` with tables alone is the fraction of rows that describe a
single material: **7 of 15 (47%)** in the given MTO. That's the number the LLM's delta is measured
against.

The three synthetic-set rows with no detected name are `S56` (a flange), `S57` (a gasket), and
`S58` (empty description). Tables **not** assigning them a catalog name is the correct behavior:
it's policy P-9 already working at the table level.

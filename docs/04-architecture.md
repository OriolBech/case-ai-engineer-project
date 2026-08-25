# Architecture

> Status: 🚧. Feeds section 2 of the 2-pager, which requires for each agent: **what it does, why
> it exists, and what happens to the KPI if you remove it.**

## Pipeline

```
Excel  →  1 ingest  →  2+3 analyze  →  4 normalize  →  5 validate  →  6 critic  →  UI
          (det.)        (LLM)           (det.)          (det.)         (LLM, sel.)
                          ↑
                    deterministic router
                    (0 model calls)
```

Stages 2 and 3 are **a single call per row**: deciding that a row describes three materials and
deciding that `ASTM A194, GR 2H` belongs to the nut and not the stud bolt is the same act of
reading. Separating them would cost ~3× the calls for the same judgment and would add a failure
mode — a bad decomposition that the second stage can't review. Detail in `specs/SPEC-002`.

## The model router

The risk that needs the strong model is **attribution**: putting an attribute on the wrong
element. That risk **only exists when the row describes more than one material** — a
single-element row has nowhere to go wrong.

`routeRow()` counts distinct catalog names using the deterministic tables in `src/rules`, so
**deciding which model to call costs no calls at all**. On the given MTO it classifies 9 rows
as multi-element and 6 as simple, which is exactly the structure of the gold set.

Its only failure mode is a set written with a single recognizable name. This isn't covered by
making the router smarter, but by escalation: if the cheap model returns more than one element on
a row the router labeled simple, it's retried with the strong one. Rare by construction, and much
cheaper than sending every row to the strong model just in case.

## Agent architecture

Of the pipeline's 6 stages, **only 3 invoke an LLM**. The others (ingest, normalize, validate)
are deterministic tables and rules — see the previous section for why each one is.

```
                         ┌──────────────────────────┐
                         │   routeRow() (det.)      │
                         │   counts names/row       │
                         │   with src/rules tables  │
                         └────────────┬─────────────┘
                                      │
                     1 element?             2+ elements?
                          │                        │
                          ▼                        ▼
                ┌──────────────────┐     ┌──────────────────────┐
   MTO row ───► │  AGENT A          │     │  AGENT A             │
                │  split+extract    │     │  split+extract       │
                │  cheap model      │     │  strong model         │
                │  1 call/row       │     │  1 call/row            │
                └────────┬──────────┘     └───────────┬───────────┘
                         │                             │
                         │   did the cheap model         │
                         │   return >1 element on a      │
                         │   "simple" row?                │
                         │   (rare, escalates)             │
                         └──────────────►───────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │  normalize + validate      │
                         │  (det., no LLM)             │
                         └────────────┬───────────────┘
                                      │
                          RESOLVED line with
                          weak evidence,
                          multi-element row?
                                      │
                                ┌─────┴─────┐
                              no │           │ yes (9/15 rows in the given MTO)
                                ▼           ▼
                          goes out as-is  ┌───────────────────────────┐
                                          │  AGENT B · critic          │
                                          │  cheap open model          │
                                          │  1 pass (today)            │
                                          │  CAN ONLY DOWNGRADE          │
                                          └────────────┬───────────────┘
                                                       │
                                          agrees:false → MANUAL_REVIEW
                                          agrees:true  → no change
                                                       │
                                                       ▼
                                                     UI (buyer)
```

### The two agents, side by side

| | **Agent A** — split + extract | **Agent B** — critic |
|---|---|---|
| Specs | SPEC-002 + SPEC-003 (single call) | SPEC-006 |
| Role | Generator: decides elements and attributes | Verifier: only compares output vs. source text |
| When it runs | Always, once per row | Selective: only multi-element rows with weak evidence (9/15) |
| No. of calls | 1/row (or 2 if the router escalates to the strong model) | **1/row today.** Repeating 2–3 times and taking the union has been evaluated (71% recall, 83% precision, see SPEC-006) but **not implemented**: it's the next pending step, not the current behavior. |
| Model | Cheap or strong, depending on `routeRow()` | Always the cheapest one (`gpt-oss-120b`) |
| Can promote to RESOLVED | N/A — it's the only one that generates | **No, never** (tested invariant) |
| Can downgrade to REVIEW | N/A | Yes — its only function |
| Worst case on failure | Badly generated line, with no safety net of its own | Provider fails → the rules' verdict is kept; it never brings down the pipeline |
| Why it's safe with a cheap model | It isn't, without the critic behind it — that's exactly why B exists | Its error is bounded: worst case is "no better than not having it" |

**Why two agents and not one.** Agent A has all the information but also all the bias: it's the
one that can hallucinate an attribution (e.g., putting `ASTM F436` as a quality). Agent B never
sees the problem from scratch: it only receives the already-normalized output plus the original
text, and its only question is "does this contradict the source?" — a narrower comprehension task
deliberately biased toward refutation. Merging them into a single call would reintroduce the very
bias it's meant to audit.

## Where there's a model and where there isn't

| Stage | LLM | What a table would do worse here | Spec |
|---|---|---|---|
| 1 · ingest | No | — (it's I/O) | SPEC-001 |
| 2 · split | **Yes** | Segmenting free-form multilingual prose with implicit elements: a table would need to enumerate every way of writing a set, and the blind set will bring others. | SPEC-002 |
| 3 · extract | **Yes** | Locating 7 attributes in free order with uncatalogued abbreviations and deciding when the attribute *isn't there*. | SPEC-003 |
| 4 · normalize | No | Nothing: these are 4 closed, exhaustive tables. Putting a model here is exactly the misjudgment the case penalizes, and it's paid for per token. | SPEC-004 |
| 5 · validate | No | Nothing: these are boolean rules. A model here would also make the result non-reproducible, and a trace has to be provided in the challenge. | SPEC-005 |
| 6 · critic | **Yes** | Detecting that the output contradicts the original text — that's comprehension, not comparison. Runs only on weak-evidence lines, and **can only downgrade**. | SPEC-006 |

## Ablations (what happens to the KPI if you remove it)

Measured with `pnpm run eval -- --ablate=<stage>` on day 4.

| Remove | Expected effect | Measured |
|---|---|---|
| split | Set explosion collapses; ~40% of output lines disappear | _pending_ |
| extract (deterministic baseline, `src/pipeline/baseline.ts`) | Free-prose rows are lost; silent error rises | **implemented** (`pnpm run eval -- --ablate=extract`). The number isn't written here yet; the piece is |
| normalize | Equivalences are lost; attributes come out unnormalized | _pending_ |
| validate | The RESOLVED/REVIEW distinction disappears: everything comes out resolved | _pending_ |
| critic | Silent error rises; cost/row falls | _pending_ |

**No-LLM baseline.** `src/pipeline/baseline.ts` is a literal reader: it splits by `findNames` and
attributes by proximity. It doesn't invent. It runs with the same harness as the LLM
(`pnpm run eval -- --ablate=extract`), with no credentials. It's the number that proves the
"know when you don't need an agent" judgment: if the deterministic baseline already resolves N%
of the attributes, the LLM only has to justify the delta. The report from that run isn't pasted
into `05-results.md` yet.

## Traceability

A requirement, not an extra: the challenge asks for a trace of specific rows. Every attribute of
every output line carries:

- `raw` — the value exactly as it appeared.
- `span` — offsets into the original text of the MTO row.
- `normalized` — the final value.
- `provenance` — `extracted | table_normalized | derived | inferred | extrapolated | absent`.
- `rule` — the identifier of the rule or policy that produced it (`G3`, `DIN934→ISO4032`, `P-1`).

## The deterministic baseline, measured

`pnpm run rules:audit`, day 0. Zero model calls.

| | Given MTO (15 rows) | Synthetic set (64 rows) |
|---|---|---|
| Rows with a name detected | 100% | 95% |
| Rows with a standard detected | 93% | 94% |
| Rows with quality recognizable in the column | 93% | 95% |
| Rows with finish detected | 53% | 41% |

**How this table should be read, and how it shouldn't.**

The 41% for finish **isn't a failure**: most rows don't carry a finish, and a blank finish is a
valid value that doesn't go to review (§9). Detecting finish in 41% of rows is correct if 41% of
rows actually carry a finish.

And more importantly: **these numbers are inflated relative to what the problem actually asks.**
They measure *"does a name appear in the row?"*, not *"is the row split into the correct number of
lines, with every attribute assigned to the correct element?"*. Row 1 of the MTO contains three
names, three standards, and three qualities: detecting all of them is trivial, and assigning
`ASTM A194` + `GR 2H` to the nut and not the stud bolt is the whole problem.

That's exactly what a table can't do, and it's what the agents have to earn their keep on. The
honest baseline for `split_fidelity` using tables alone is the fraction of rows that describe a
single material: **6 of 15 (40%)** in the given MTO (rows 10–15 of the gold; the other 9 are
multi-material). That's the number against which the LLM's delta is measured.

The three rows of the synthetic set with no name detected are `S56` (a flange), `S57` (a gasket),
and `S58` (empty description). That the tables **don't** assign them a catalog name is the correct
behavior: it's policy P-9 already working at the table level.

## Bounded contexts

The case is won if **the domain doesn't depend on the LLM, on Next, or on SQLite**, and if every
context has a reason to exist. Four contexts, one kernel:

| Context | Where | Writes | Read by the LLM |
|---|---|---|---|
| **Catalog** | `src/rules/` | Never at runtime. Alias via vocabulary (SPEC-012) | No |
| **Pipeline** | `src/pipeline/` | Lines of an MTO. No history, no reviews | Yes, only analyze + critic |
| **Identity and revisions** | `src/domain/` | Nothing at runtime. Diff is a use case **after** `processMto` | **Forbidden** (SPEC-014) |
| **Evaluation and learning** | `src/eval/` | Gold, corrections, suggestions. Outside `processMto` | No |

Dependency rule: `domain` doesn't import `lib/llm.ts` or `app/`. The pipeline **adapts**
`OutputLine` → `IdentifiableLine` (`from-output.ts`); the domain doesn't know about Excel.

What has deliberately not been done: the repo hasn't been split into `apps/api` + `apps/web` +
`packages/domain`. An extra monorepo doesn't buy KPI. The identity kernel and the promotion
classifier (`classifyPromotion`) are the DDD the case asks for: clear boundaries, 0 model where
string equality suffices. Revision persistence and diff UI: SPEC-014, done (`src/revisions/`,
`/mto-history/compare`). End-to-end promotion of corrections: SPEC-015 (the orchestrator requires
an explicit eval; choosing a value in the UI is still out of scope).

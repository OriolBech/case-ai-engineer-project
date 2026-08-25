# MTO Reconciliation · Fasteners

Extraction and normalization system for fastener lines from engineering MTOs (Material
Take-Off). AI Engineer technical case · Sapira.

## Cold start

With Node and pnpm:

```bash
cp .env.example .env.local
pnpm install
pnpm run dev                    # http://localhost:3000
```

Docker only (no Node or pnpm on the machine):

```bash
cp .env.example .env.local      # and paste in the API keys
docker compose up --build       # http://localhost:3000
```

Project commands (`check`, `eval`, `vocab`, …) are run inside the container:

```bash
docker compose exec app pnpm test
docker compose exec app pnpm run eval
```

A single process. The procedure is documented; the **timed cold start is still
pending** and will be done at the end, after the measurements that depend on the cache.

```bash
pnpm run check                  # typecheck + tests
pnpm run rules:audit            # alias provenance + deterministic baseline
pnpm run eval                   # harness against the gold set
pnpm run eval -- --report       # dumps report to eval/reports/
pnpm run eval -- --ablate=extract  # same harness, LLM-free reader (src/pipeline/baseline.ts)
pnpm run traps                  # trap bench (rules, not gold; 0 LLM)
pnpm run suggestions:kpi        # standalone vocabulary-suggestion KPI (0/0 without a buyer)
pnpm run vocab                  # material vocabulary CLI
pnpm run finish:vocab           # finish vocabulary CLI
pnpm run mto:synthetic          # test-bed MTO: extra columns to impute several vocabularies
```

Node 26 runs TypeScript natively, so there is no build step for the pipeline or the
harness. That's why relative imports carry an explicit `.ts` extension (see `tsconfig.json`).

## What it does

An MTO Excel file comes in. Each row may describe a single material or a complete **set**
(bolt + nut + washers), and in that case it is split into one line per element. For each
output line, seven attributes are extracted and normalized, and the line ends up in one of two
states:

- `RESUELTA` (resolved) — all seven attributes normalized.
- `REVISION_MANUAL` (manual review) — a required attribute is missing or there is an inconsistency, with a typed reason.

## Where everything is

| Path | What it contains |
|---|---|
| `AGENTS.md` | The contract for the agent that maintains the repo. There are two harnesses: the eval one (`pnpm run eval`) and this one. See ADR-006. |
| `app/` | Front end (Next.js App Router) and API routes. The user is a buyer, not an engineer. |
| `src/pipeline/` | The six stages: ingest → split → extract → normalize → validate → critic. The LLM-free baseline is in `baseline.ts`. |
| `src/rules/` | Tables and the deterministic engine. **No LLM.** Material and finish live in SQLite + log (`vocabulary-db.ts`, `finish-db.ts`); the rest lives in code. |
| `src/eval/` | Evaluation harness and metrics. |
| `specs/` | **What each component must do**: contract, I/O, acceptance criteria. Kept up to date with the code. |
| `docs/` | **Why**: plan, requirements, KPI, policies, architecture, results, 2-pager. |
| `docs/decisions/` | ADRs. Append-only: a decision once made is not rewritten, it is superseded. |
| `data/input/` | Original case files. Read-only. |
| `data/gold/` | Hand-labeled gold set. The reference against which we measure. |
| `data/traps/` | Trap bench: rule invariants, independent of the gold set. `pnpm run traps`. |
| `data/synthetic/` | Synthetic robustness rows, generated from the rules (not from the given MTO). |

## Conventions

- Documentation in English; the 2-pager, the buyer UI, and literal system values stay in Spanish (ADR-001).
- **No build step**: Node runs TypeScript in *strip-only* mode. That implies two
  restrictions throughout the code: relative imports with an explicit `.ts` extension, and **no
  parameter properties** (`constructor(private x: T)`), no `enum`, and no `namespace`. Fields are
  declared explicitly.
- Everything the system decides that is not written in the client's rules lives in
  `docs/03-policies.md` and is **switchable via flag**. There is no implicit behavior.
- Every output line carries traceability: the literal span from the MTO that justifies each attribute.

# MTO Reconciliation · Fasteners

A system for extracting and normalizing fastener lines from engineering MTOs (Material Take-Offs).
AI Engineer technical case · Sapira.

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

The project's commands (`check`, `eval`, `vocab`, …) run inside the container:

```bash
docker compose exec app pnpm test
docker compose exec app pnpm run eval
```

A single process. Verified from scratch before the session (see `docs/00-action-plan.md`, day 5).

```bash
pnpm run check                  # typecheck + tests
pnpm run rules:audit            # alias provenance + deterministic baseline
pnpm run eval                   # harness against the gold set
pnpm run eval -- --report       # dumps report to eval/reports/
pnpm run eval -- --ablate=extract  # same harness, no-LLM reader (src/pipeline/baseline.ts)
pnpm run suggestions:kpi        # vocabulary-suggestion KPI of its own (0/0 with no buyer)
pnpm run vocab                  # material vocabulary CLI
pnpm run finish:vocab           # finish vocabulary CLI
pnpm run mto:synthetic          # test-bed MTO: extra columns to impute several vocabularies
```

Node 26 runs TypeScript natively, so there's no build step for the pipeline or the harness.
Relative imports carry an explicit `.ts` extension because of that (see `tsconfig.json`).

## What it does

An MTO Excel file goes in. Each row can describe a single material or a full **set** (bolt + nut +
washers), and in that case it gets split into one line per element. For each output line, seven
attributes are extracted and normalized, and the line ends up in one of two states:

- `RESUELTA` (RESOLVED) — all seven attributes normalized.
- `REVISION_MANUAL` (MANUAL_REVIEW) — a required one is missing or there's an inconsistency, with
  a typed reason.

## Where everything is

| Path | What it contains |
|---|---|
| `app/` | Front end (Next.js App Router) and API routes. The user is a buyer, not an engineer. |
| `src/pipeline/` | The six stages: ingest → split → extract → normalize → validate → critic. The no-LLM baseline is in `baseline.ts`. |
| `src/rules/` | Deterministic tables and engine. **No LLM.** Material and finish live in SQLite + log (`vocabulary-db.ts`, `finish-db.ts`); the rest, in code. |
| `src/eval/` | Evaluation harness and metrics. |
| `specs/` | **What** each component must do: contract, I/O, acceptance criteria. Updated alongside the code. |
| `docs/` | **Why**: plan, requirements, KPI, policies, architecture, results, 2-pager. |
| `docs/decisions/` | ADRs. Append-only: a decision that's been made isn't rewritten, it's superseded. |
| `data/input/` | Original files from the case. Read-only. |
| `data/gold/` | Hand-labeled gold set. The reference measured against. |
| `data/synthetic/` | Synthetic robustness rows, generated from the rules (not from the given MTO). |

## Conventions

- Documentation in Spanish, code and identifiers in English (ADR-001).
- **No build step**: Node runs TypeScript in *strip-only* mode. That implies two constraints
  throughout the code: relative imports with an explicit `.ts` extension, and **no parameter
  properties** (`constructor(private x: T)`), no `enum`, no `namespace`. Fields are declared
  explicitly.
- Everything the system decides that isn't written in the client's rules lives in
  `docs/03-policies.md` and is **switchable via flag**. There's no implicit behavior.
- Every output line carries traceability: the literal span from the MTO that justifies each
  attribute.

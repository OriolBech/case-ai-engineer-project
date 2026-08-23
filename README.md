# MTO Reconciliation · Fasteners

Extraction and normalization system for fastener lines from engineering MTOs (Material
Take-Off). AI Engineer technical case · Sapira.

## Cold start

```bash
cp .env.example .env.local     # and fill in ANTHROPIC_API_KEY
pnpm install
pnpm run dev                    # http://localhost:3000
```

A single process. Verified from scratch before the session (see `docs/00-action-plan.md`, day 5).

```bash
pnpm run check                  # typecheck + tests  (already works)
pnpm run rules:audit            # alias provenance + deterministic baseline  (already works)
pnpm run eval                   # evaluation harness against the gold set  (pending)
pnpm run eval -- --report       # dumps report to eval/reports/  (pending)
```

Node 26 runs TypeScript natively, so there's no build step for either the pipeline or the
harness. Relative imports carry an explicit `.ts` extension because of this (see `tsconfig.json`).

## What it does

An MTO Excel file goes in. Each row can describe a single material or a full **set** (bolt +
nut + washers), in which case it's split into one line per element. For each output line,
seven attributes are extracted and normalized, and the line ends up in one of two states:

- `RESUELTA` — the seven attributes normalized.
- `REVISION_MANUAL` — a required attribute is missing or there's an inconsistency, with a typed reason.

## Where everything lives

| Path | What it contains |
|---|---|
| `app/` | Front end (Next.js App Router) and API routes. The user is a buyer, not an engineer. |
| `src/pipeline/` | The six stages: ingest → split → extract → normalize → validate → critic. |
| `src/rules/` | Deterministic tables and engine. **No LLM.** Quality equivalences, DIN→ISO, finishes, names. |
| `src/eval/` | Evaluation harness and metrics. |
| `specs/` | **What** each component must do: contract, I/O, acceptance criteria. Updated together with the code. |
| `docs/` | **Why**: plan, requirements, KPI, policies, architecture, results, 2-pager. |
| `docs/decisions/` | ADRs. Append-only: a decision once made isn't rewritten, it's superseded. |
| `data/input/` | Original files from the case. Read-only. |
| `data/gold/` | Hand-labeled gold set. The reference measured against. |
| `data/synthetic/` | Synthetic robustness rows, generated from the rules (not from the given MTO). |

## Conventions

- Documentation in Spanish, code and identifiers in English (ADR-001).
- **No build step**: Node runs TypeScript in *strip-only* mode. That implies two
  restrictions across all the code: relative imports with an explicit `.ts` extension, and **no
  parameter properties** (`constructor(private x: T)`), no `enum`, and no `namespace`. Fields are
  declared explicitly.
- Anything the system decides that isn't written in the client's rules lives in
  `docs/03-policies.md` and is **toggleable via flag**. There's no implicit behavior.
- Every output line carries traceability: the literal span from the MTO that justifies each attribute.

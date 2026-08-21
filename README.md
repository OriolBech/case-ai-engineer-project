# MTO Reconciliation · Fastener Hardware

Extraction and normalization system for fastener-hardware lines from engineering MTOs (Material
Take-Off). Sapira AI Engineer technical case.

## Cold start

```bash
cp .env.example .env.local     # and fill in ANTHROPIC_API_KEY
npm install
npm run dev                    # http://localhost:3000
```

A single process. Verified from scratch before the session (see `docs/00-action-plan.md`, day 5).

```bash
npm run check                  # typecheck + tests  (already works)
npm run rules:audit            # alias provenance + deterministic baseline  (already works)
npm run eval                   # evaluation harness against the gold set  (pending)
npm run eval -- --report       # dumps report to eval/reports/  (pending)
```

Node 26 runs TypeScript natively, so there's no build step for the pipeline or the harness. That's
why relative imports carry an explicit `.ts` extension (see `tsconfig.json`).

## What it does

An MTO Excel file goes in. Each row can describe a single material or a complete **set**
(bolt + nut + washers), in which case it's split into one line per element. For each output line,
seven attributes are extracted and normalized, and the line ends up in one of two states:

- `RESUELTA` — all seven attributes normalized.
- `REVISION_MANUAL` — a mandatory field is missing or there's an incoherence, with a typed reason.

## Where everything is

| Path | What it contains |
|---|---|
| `app/` | Front end (Next.js App Router) and API routes. The user is a buyer, not an engineer. |
| `src/pipeline/` | The six stages: ingest → split → extract → normalize → validate → critic. |
| `src/rules/` | Deterministic tables and engine. **No LLM.** Grade equivalences, DIN→ISO, finishes, names. |
| `src/eval/` | Evaluation harness and metrics. |
| `specs/` | **What** each component must do: contract, I/O, acceptance criteria. Updated together with the code. |
| `docs/` | **Why**: plan, requirements, KPI, policies, architecture, results, 2-pager. |
| `docs/decisions/` | ADRs. Append-only: a decision once made is never rewritten, only superseded. |
| `data/input/` | Original case files. Read-only. |
| `data/gold/` | Hand-labeled gold set. The reference against which things are measured. |
| `data/synthetic/` | Synthetic robustness rows, generated from the rules (not from the given MTO). |

## Conventions

- Documentation in Spanish, code and identifiers in English (ADR-001).
- Everything the system decides that isn't written in the client's rules lives in
  `docs/03-policies.md` and is **switchable via flag**. There is no implicit behavior.
- Every output line carries traceability: the literal MTO span that justifies each attribute.

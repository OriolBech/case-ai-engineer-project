# ADR-001 · Next.js monolith in TypeScript

- **Date**: 2026-08-20
- **Status**: accepted

## Context

The brief gives a preferred stack ("Python or Node.js, Next.js or React") and two hard
requirements that shape the choice more than technical preference: the system **runs on my own
machine during the call** and it has to be **checked before it cold-starts**. The budget is 5–10
hours.

## Decision

A single Next.js project (App Router) in TypeScript. Front end and pipeline in the same runtime;
the pipeline is invoked from an API route and also from a CLI script for the evaluation harness
(`tsx`). The deterministic rules engine is implemented in plain TS, with no dependencies.

## Alternatives discarded

| Alternative | Why not |
|---|---|
| Python (FastAPI) + separate Next.js | Better eval and data ergonomics (pandas, pytest), but two runtimes and two processes: more failure surface at cold start during the call, and ~1 hour of budget spent on orchestration that isn't evaluated. |
| Full-stack Python (Jinja/HTMX) | A single process, but the front end is the first thing people see and the brief asks for care there. Fewer tools for that. |

## Consequences

**For**: a single `npm install && npm run dev`. Types shared between pipeline and front end
without duplicating the contract. The same code that runs the demo runs the eval harness.

**Against**: results analysis and gold-set handling are clunkier than in Python. Mitigated by
dumping the eval report to Markdown and CSV in `eval/reports/`, rather than analyzing it at
runtime.

## How to revert it

The pipeline in `src/` doesn't depend on Next. Porting it to a separate backend is a matter of
moving a folder and adding a server.

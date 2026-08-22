# Documentation

Separation of responsibilities:

- **`docs/`** — the *why*. Reasoning, analysis, decisions, and deliverables. Read from start to
  finish. This is where the 2-pager comes from.
- **`specs/`** — the *what*. Each component's contract: inputs, outputs, acceptance criteria.
  Consulted on demand and kept in sync with the code.
- **`docs/decisions/`** — ADRs. One decision per file, **append-only**: they are never
  rewritten, only marked as superseded by another.

## Index

| Doc | What it is | Status |
|---|---|---|
| [00-action-plan.md](00-action-plan.md) | 5–10 h plan, proposed architecture, timeline | ✅ |
| [01-case-requirements.md](01-case-requirements.md) | Everything the brief asks for, extracted and structured | ✅ |
| [02-kpi.md](02-kpi.md) | What I measure against, what I measure, what I commit to, where the threshold goes | 🚧 |
| [03-policies.md](03-policies.md) | The 6 ambiguities from section 10, decided and switchable | 🚧 |
| [04-architecture.md](04-architecture.md) | Agent by agent: what it does, why it exists, what happens to the KPI if you remove it | 🚧 |
| [05-results.md](05-results.md) | Results against the KPI, per-attribute breakdown, dropped rows | ⬜ |
| [06-production-risks.md](06-production-risks.md) | The 3 real risks outside the laptop | ⬜ |
| [07-target-solution.md](07-target-solution.md) | What I'd build with no time limit, and what delta it buys | ⬜ |
| [08-not-done.md](08-not-done.md) | What I've decided not to do, and why | ⬜ |
| [09-coverage-and-blind-set.md](09-coverage-and-blind-set.md) | Coverage matrix, blind-set prediction, targeted synthetic set | ✅ |
| [10-timeline.md](10-timeline.md) | Project chronology: how it was iterated on and reasoned through, session by session | ✅ |
| [domain/](domain/) | Industry knowledge: what an MTO is, the 5 materials, standards, qualities, finishes. For reading the Excel without being a buyer | ✅ |
| [11-benchmarks.md](11-benchmarks.md) | All the measurements, with method, dates, and limitations | ✅ |
| [decisions/](decisions/) | ADRs (001 stack · 002 questions · 003 LLM provider · 004 cache) | ✅ |
| [client-questions/](client-questions/) | The 3 questions and their answers | ✅ |
| [2-pager/](2-pager/) | The final deliverable (max. 2 pages) | ⬜ |
| [design-system/](design-system/DESIGN-SYSTEM.md) | Sapira's design system extracted from sapira.ai, for the buyer UI | ✅ |

Legend: ✅ closed · 🚧 in progress · ⬜ pending

## Traceability to the 2-pager

The 2-pager has six sections mandated by the brief. Each one is fed by a doc, so it doesn't get
written from scratch on the last day:

| 2-pager section | Source |
|---|---|
| 1. Problem + proposed KPI | `01-requisitos` + `02-kpi` |
| 2. Agent-to-agent solution | `04-arquitectura` |
| 3. Results and where it fails | `05-resultados` |
| 4. Target solution | `07-solucion-objetivo` |
| 5. What I've decided not to do | `08-no-hecho` |
| 6. What breaks in production | `06-riesgos-produccion` |

# SPEC-016 · Buyer KPI panel

| | |
|---|---|
| **Files** | `src/kpi/`, `app/api/kpis/`, `app/components/KpiDashboardScreen.tsx` |
| **Stage** | Product observability |
| **LLM** | No |
| **Status** | ✅ |
| **Related specs** | `SPEC-008` · `SPEC-009` · `SPEC-010` · `SPEC-015` |

## Purpose

To make every commitment from the 2-pager visible in buyer language, without presenting as
measured what still has no data. The panel lives at `/kpis` and always distinguishes:

- **Measured**: comes from a saved evaluation or from observed events.
- **Target**: committed threshold, not a result.
- **Not available**: missing run, price, or sample.

## Sources and derivations

1. The latest run from `evaluation_runs` feeds silent error (rate and count), useful autonomy,
   split fidelity, queue noise, and the breakdown by the seven attributes plus quantity.
2. Cost per row divides configured cost by rows read. The site projects 500,000 reads.
3. Latency for 1,000 rows extrapolates the serial run and separately shows ideal concurrency 8.
   It always carries the caveat that a single run isn't an SLA.
4. Estimated hours saved are `2,500 h × useful autonomy`. They aren't clocked time.
5. The agile flow doesn't show an intermediate funnel: accepting a suggestion writes to
   vocabulary.
6. Reuse counts observed uses of ids saved from the UI —and historical promotions— in attributes
   of MTOs processed afterward.
7. Correction time is measured in a separate SQLite store, from opening a reviewable line to
   saving the decision. Without complete pairs, it shows a ≤90 s target and a zero sample, not a
   p50.
8. The same KPI store keeps review and purchase milestones by
   `(projectId, revisionId, flowId)`: review opened/closed, RFQ, order, vendor confirmation, and
   delivery.
9. Processing an MTO logs review opening. Exporting the RFQ logs review closing and sending.
   Later milestones are entered from `/kpis`.
10. p50, p90, and sample size are published for review, RFQ→order, order→confirmation,
    order→delivery, and RFQ→delivery.

## Invariants

1. The open MTO, without gold, never gets accuracy figures from the latest evaluation.
2. Unknown cost is not available, never zero.
3. Silent error is shown with a count and alongside split fidelity.
4. Quantity is part of the breakdown.
5. The KPI event store doesn't approve, reject, promote, or modify corrections.
6. An entry or promotion with no subsequent use doesn't count as reuse.
7. Repeating the same milestone of the same flow is idempotent: it doesn't create another sample.
8. Purchase events don't mutate snapshots, RFQs, orders, or corrections; they only record times.

## Acceptance criteria

- [x] `/kpis` is reachable from the main navigation and from "Cómo ha ido" ("How it went").
- [x] Every KPI from the 2-pager has a card, section, or explicit empty state.
- [x] Correction time shows target, sample size, p50, and p90 when they exist.
- [x] Derivations and no-history state have tests.
- [x] The RFQ/order/vendor/delivery cycle has persistence, a form, and empty states.
- [x] Operational timelines show p50, p90, and sample size.

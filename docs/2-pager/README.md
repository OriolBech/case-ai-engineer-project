# 2-pager

**Two pages, maximum.** It's the deliverable that matters most after the system itself. Sent
together with the repo link **24 h before the session**.

Written on day 5 by **assembling** the docs, not from scratch:

| Section | Source | Status |
|---|---|---|
| 1. The problem as I understood it + the KPI I'm proposing | `../01-case-requirements.md` + `../02-kpi.md` | ✅ |
| 2. The solution, agent by agent (what it does / why it exists / what happens to the KPI if I remove it) | `../04-architecture.md` | ✅ deliverable; the source keeps deterministic ablations pending |
| 3. Results against my KPI and where it fails, with a per-attribute breakdown | `../05-results.md` | ✅ |
| 4. The target solution | `../07-target-solution.md` · SPEC-014/015 | ✅ |
| 5. What I've decided not to do, and why | `../08-not-done.md` | ✅ |
| 6. What breaks this in production (3 risks) | `../06-production-risks.md` | ✅ |

Draft in `2-pager.md`. Deliverable: [`2-pager.pdf`](2-pager.pdf) (A4, 2 pages).

```bash
python3 scripts/2-pager-pdf.py
```

Real constraint: two pages for six sections is ~350 words per section. Anything that doesn't fit
stays in `docs/` and is referenced from there.

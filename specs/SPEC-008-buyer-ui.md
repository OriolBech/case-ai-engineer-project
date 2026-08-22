# SPEC-008 · Buyer front end

| | |
|---|---|
| **Files** | `app/`, `app/components/` |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

That a buyer who receives the MTO on Monday morning can send out the RFQs that same week
**without opening an Excel file alongside it**. That is the brief's literal acceptance criterion.

## The user

Not an engineer or a data scientist. One of the six procurement people who today read row by row
at 90 s per row. Has spent twenty years buying bolts and doesn't believe this will work.

## Screens

### 1. Upload MTO
Drag & drop of the `.xlsx`. Progress bar with the number of rows processed. When it finishes,
three numbers up top: **% resolved**, **€ for this MTO**, **time**. It's the first thing seen and
the first thing asked about.

### 2. Work queue (the main screen)
A table of **output lines**, not MTO rows, visually grouped by source row so the set explosion is
visible.

It must carry:
- `RESUELTA` / `REVISION_MANUAL` badge with the reason in readable text, not a code.
- **Two separate queues** by reason type: *"the data is missing from the MTO"* → goes back to
  engineering; *"the system isn't sure"* → the buyer resolves it. These are two different actions
  and the brief requires distinguishing them.
- **Quantity per element**, with a visible mark when it's inferred.
- Visible mark on any attribute that isn't `extracted` (derived, extrapolated, inferred).
- **Grouping by family**, which is the next step in the real workflow: who to ask.
- Bulk actions: confirm N lines with the same reason at once. With 4,000 rows, resolving one at a
  time isn't a product.

### 3. Trace panel
Clicking a line shows: the **original row text with the highlighted span** that justifies each
attribute, and the rule or policy that produced it (`G3`, `DIN 934→ISO 4032`, `P-1`).
**This is explicitly requested in the challenge** ("we'll ask you for the trace of specific
rows"), so it isn't an extra: it's a requirement.

### 4. Export
CSV/Excel of the resolved lines, grouped by family, ready for RFQ. Plus a separate export of
those going back to engineering.

## What it does NOT carry

Login, multi-user, MTO history, analytics dashboards. See `docs/08-not-done.md`.

## Acceptance criteria

- [ ] The 15-row MTO can be walked from start to finish and exported without opening Excel.
- [ ] Each line shows its reason in buyer language, not an enum.
- [ ] The trace of any attribute is one click away.
- [ ] A 1,000-line MTO stays navigable (virtualization or pagination).
- [ ] Starts cold with `npm run dev` and needs no prior manual step other than the API key.

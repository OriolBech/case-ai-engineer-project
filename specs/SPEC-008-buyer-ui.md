# SPEC-008 · Buyer front end

| | |
|---|---|
| **Files** | `app/`, `app/components/` |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

So that a buyer who receives the MTO on Monday morning can send out the RFQs that same week
**without opening an Excel on the side**. That is the brief's literal acceptance criterion.

## The user

Not an engineer or a data scientist. One of the six procurement people who today read row by row
at 90 s per row. Twenty years buying bolted fasteners, and doesn't believe this will work.

## Screens

### 1. Upload MTO
Drag & drop the `.xlsx`. Progress bar with the number of rows processed. When done, three
numbers up top: **% resolved**, **€ for this MTO**, **time**. It's the first thing seen and the
first thing asked about.

### 2. Work queue (the main screen)
A table of **output lines**, not MTO rows, visually grouped by source row so the set explosion is
visible.

Must include:
- `RESOLVED` / `MANUAL_REVIEW` badge with the reason in readable text, not a code.
- **Separate queues** by reason type, because each one is an action for a different person:
  *"the data is missing from the MTO"* → goes back to engineering; *"the system isn't sure"* → the
  buyer resolves it. The brief requires distinguishing these two. We add the third: *"this isn't a
  bolted fastener"* (P-9) → neither resolved, nor for the buyer, nor for engineering, which has
  nothing to fix on a row that's fine. It goes to whoever buys its family, and it's **outside the
  percentages**.
- **Quantity per element**, with a visible mark when inferred.
- Visible mark on any attribute that isn't `extracted` (derived, extrapolated, inferred).
- **Grouping by family**, which is the next step in the actual workflow: who to ask.
- Bulk actions: confirm N lines with the same reason at once. With 4,000 rows, resolving one at a
  time isn't a product.

### 3. Trace panel
Clicking a line: the **original row text with the span highlighted** that justifies each
attribute, and the rule or policy that produced it (`G3`, `DIN 934→ISO 4032`, `P-1`).
**This is explicitly requested in the challenge** ("we'll ask you for the trace of specific
rows"), so it's not an extra: it's a requirement.

### 4. Export
CSV/Excel of resolved lines, grouped by family, ready for RFQ. Plus a separate export of the
ones going back to engineering, and of the ones that aren't bolted fasteners.

## What it does NOT include

Login, multi-user support, MTO history, analytics dashboards. See `docs/08-not-done.md`.

## Acceptance criteria

- [ ] The 15-row MTO can be walked through start to finish and exported without opening Excel.
- [ ] Every line shows its reason in buyer language, not an enum.
- [ ] The trace for any attribute is a click away.
- [ ] A 1,000-line MTO is still navigable (virtualization or pagination).
- [ ] Starts cold with `pnpm run dev` and needs no manual prior step other than the API key.

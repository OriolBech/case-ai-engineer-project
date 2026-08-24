# SPEC-008 · Buyer front end

| | |
|---|---|
| **Files** | `app/`, `app/components/` |
| **LLM** | No |
| **Status** | ✅ implemented (pagination, no virtualization at 1,000 lines) |

## Purpose

That a buyer who receives the MTO on Monday morning can get the RFQs out that same week **without
opening an Excel file alongside it**. That is the brief's literal acceptance criterion.

## The user

Not an engineer or a data scientist. One of the six procurement people who today read row by row
at 90 s per row. Twenty years buying fasteners, and doesn't believe this will work.

## Screens

### 1. Upload MTO
Drag & drop the `.xlsx`. Progress bar with the number of rows processed. When it finishes, three
numbers up top: **% resolved**, **€ for this MTO**, **time**. It's the first thing you see and the
first thing you ask about.

### 2. Work queue (the main screen)
A table of **output lines**, not MTO rows, visually grouped by source row so the set explosion is
visible.

Must have:
- `RESUELTA` / `REVISION_MANUAL` badge with the reason in readable text, not a code.
- **Separate queues** by reason type, because each one is a different person's action: *"falta el
  dato en el MTO"* (the data is missing from the MTO) → goes back to engineering; *"el sistema no
  está seguro"* (the system isn't sure) → the buyer resolves it. The brief requires distinguishing
  these two. We added the third one ourselves: *"esto no es tornillería"* (this isn't fastener
  hardware) (P-9) → neither resolved, nor the buyer's, nor engineering's, since there's nothing to
  fix on a row that's fine as it is. It goes to whoever buys its family, and **outside the
  percentages**.
- **Quantity per element**, with a visible mark when it's inferred.
- Visible mark on any attribute that isn't `extracted` (derived, extrapolated, inferred).
- **Grouping by family**, which is the next step in the real workflow: who it gets sent to.
- Bulk actions: confirm N lines with the same reason at once. With 4,000 rows, resolving them one
  at a time isn't a product.

### 3. Trace panel
Clicking a line shows: the **original row text with the highlighted span** that justifies each
attribute, and the rule or policy that produced it (`G3`, `DIN 934→ISO 4032`, `P-1`). **This is
explicitly requested in the challenge** ("we'll ask you for the trace of specific rows"), so it
isn't an extra: it's a requirement.

### 4. Export
CSV/Excel of the resolved lines, grouped by family, ready for RFQ. Plus a separate export for
lines going back to engineering, and for ones that aren't fastener hardware.

### 5. Vocabulario (single view)
`/vocabulario` — SPEC-012. The five attributes in one table; material and finish are extended from
there (and from the queue, via quick-add). `?attr=` and `?alias=` open the add form pre-filled.
There is no per-attribute page.

### 6. Cómo funciona · Histórico de MTOs
Main navigation (`AppNav`): Cómo funciona · Vocabulario · Histórico. The evaluation history
(`/eval-history`) exists and is deliberately left out of that nav bar.

In the queue, an unrecognized finish is flagged and can be added without leaving the line
(`FinishVocabAddPanel`). Accepting a suggestion rewrites the lines of the open MTO and leaves them
**unvalidated** (SPEC-013). The patch lives in the session; it doesn't mutate the pipeline's raw
result.

## What it does NOT have

Login, multi-user, analytics dashboards. See `docs/08-not-done.md`.
The MTO history **does** exist (`/mto-history`). So does the evaluation history, outside the nav.

## Acceptance criteria

- [x] You can go through the 15-row MTO from start to finish and export it without opening Excel.
- [x] Every line shows its reason in buyer language, not an enum.
- [x] The trace for any attribute is one click away.
- [x] A 1,000-line MTO is paginated 20 at a time. No virtualization.
- [x] Cold-starts with `pnpm run dev` and needs no manual step beforehand other than the API key.
- [x] `/vocabulario` is a single view; there are no `/vocabulario/acabado` routes or per-attribute
      API routes.
- [x] An unknown finish can be resolved from the queue or from `/vocabulario` without a deploy.

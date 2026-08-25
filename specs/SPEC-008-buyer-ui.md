# SPEC-008 · Buyer front end

| | |
|---|---|
| **Files** | `app/`, `app/components/` |
| **LLM** | No |
| **Status** | ✅ implemented (pagination, no virtualization at 1,000 lines) |

## Purpose

So that a buyer who receives the MTO on Monday morning can put together the RFQs that same week
**without opening an Excel file on the side**. That is the literal acceptance criterion of the
case statement.

## The user

Not an engineer or a data scientist. One of the six procurement people who today read row by row
at 90 s per row. Twenty years buying bolts, and doesn't believe this will work.

## Screens

### 1. Upload MTO
Drag & drop of the `.xlsx`. Progress bar with the number of rows processed. When it finishes,
three numbers up top: **% resolved**, **€ of this MTO**, **time**. It's the first thing seen and
the first thing asked about.

### 2. Work queue (the main screen)
A table of **output lines**, not MTO rows, visually grouped by source row so the set explosion is
visible.

It must include:
- A `RESUELTA` / `REVISION_MANUAL` badge with the reason in readable text, not a code.
- **Separate queues** by reason type, because each one is an action for a different person:
  *"the data is missing from the MTO"* → goes back to engineering; *"the system isn't sure"* → the
  buyer resolves it. The case statement requires distinguishing these two. We added the third:
  *"this isn't fastening hardware"* (P-9) → neither resolved, nor the buyer's, nor engineering's,
  which has nothing to fix on a row that's perfectly fine. It goes to whoever buys its actual
  family, and **outside the percentages**.
- **Quantity per element**, with a visible marker when it's inferred.
- Visible marker on any attribute that isn't `extracted` (derived, extrapolated, inferred).
- **Grouping by family**, which is the next step in the real workflow: who it gets sent to.
- Bulk actions: confirm N lines with the same reason at once. With 4,000 rows, resolving them one
  by one isn't a product.

### 3. Trace panel
Clicking a line shows: the **original row text with the highlighted span** that justifies each
attribute, and the rule or policy that produced it (`G3`, `DIN 934→ISO 4032`, `P-1`).
**This is explicitly requested in the challenge** ("we will ask for the trace of specific rows"),
so it isn't an extra — it's a requirement.

### 4. Export
CSV/Excel of the resolved lines, grouped by family, ready for RFQ. Plus a separate export of the
lines that go back to engineering, and of the ones that aren't fastening hardware.

### 5. Vocabulary (a single view)
`/vocabulario` — SPEC-012. The five attributes in one table; material and finish are expanded from
there (and from the queue, with quick add). `?attr=` and `?alias=` open the add form pre-filled.
There is no per-attribute page.

### 6. How it works · Results · MTO history
Main navigation (`AppNav`): How it works · Results · Vocabulary · History. Results opens `/kpis`
(SPEC-016) and distinguishes measurement, target, and unavailable data. The evaluation history
(`/eval-history`) exists and is deliberately left out of that bar.

In the queue, an unrecognized finish is flagged and can be added without leaving the line
(`FinishVocabAddPanel`). Accepting a suggestion saves the decision to the vocabulary, rewrites and
accepts all matching cases in the currently open MTO, and keeps it active for future MTOs
(SPEC-013). The screen's patch lives in the session; it does not mutate the pipeline's already
persisted raw output.

## What it does NOT include

Login, multi-user support, and full time-series analytics. The scoped KPI commitments panel does
exist at `/kpis`; it doesn't allow editing evaluations or governance settings. See
`docs/08-not-done.md`. The MTO history **does** exist (`/mto-history`). So does the evaluation
history, outside the nav.

## Acceptance criteria

- [x] The 15-row MTO can be walked through start to finish and exported without opening Excel.
- [x] Each line shows its reason in buyer language, not an enum.
- [x] The trace for any attribute is one click away.
- [x] A 1,000-line MTO is paginated 20 at a time. No virtualization.
- [x] Cold starts with `pnpm run dev` and needs no manual step beforehand except the API key.
- [x] `/vocabulario` is a single view; there are no `/vocabulario/acabado` routes or per-attribute
      API routes.
- [x] An unknown finish can be closed out from the queue or from `/vocabulario` without deploying.

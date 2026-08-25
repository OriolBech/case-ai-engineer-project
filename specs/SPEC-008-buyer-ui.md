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

### 3. Trace panel — and the only place decisions are taken
Clicking a line shows: the **original row text with the highlighted span** that justifies each
attribute, and the rule or policy that produced it (`G3`, `DIN 934→ISO 4032`, `P-1`).
**This is explicitly requested in the challenge** ("we will ask for the trace of specific rows"),
so it isn't an extra — it's a requirement.

The same drawer carries the **decisions this line is waiting on** (`LineDecisions`): a quality no
group covers (SPEC-017), a quality no vocabulary entry derives a material from, a finish outside
the §9 catalogue (SPEC-011). One rule, and it is a product decision, not a layout accident:

> **"How it went" counts the decisions. The line's drawer is where they are taken.**

They used to live in the KPI panel, next to the run's metrics, and that was the wrong place twice
over. A vocabulary decision is taken *looking at the row* — the original text, the other
attributes, what gets bought wrong if it is decided badly — and none of that is on a metrics
screen. And whoever reviews works down the queue line by line: making them close the queue, open
the summary and find the value in an aggregated list is asking them to move house to fix what is
already in front of them. The KPI panel keeps the count and the list, because *how many decisions
this MTO is owed* is a metric of the review; it carries no button that writes to the vocabulary.

A decision is still **one** even if the value appears in forty rows: saving it from this line
applies it to every line sharing the value, in this MTO and the ones that follow. The queue makes
it discoverable with a per-line hint ("clic para decidir la calidad y el acabado"), so the drawer
is not something you have to know about beforehand.

**The three attributes behave identically, and that is the requirement.** Finish always triggered
off the line's own attribute; quality and material only appeared when `coverage.ts` had raised a
gap — and there are cases where it deliberately does not raise one. An ASTM grade like `GR L7` or
`GR B7` is outside the §5 catalogue and §5 says to keep it verbatim, so it is not a gap; but a
buyer who knows it maps to a group in their house had nowhere to say so. The system looked like it
refused to learn precisely on the lines where the buyer knows more than the table. All three now
trigger off the attribute (`lineNeedsQualityVocab`, `lineNeedsMaterialVocab`,
`lineNeedsFinishVocab`); the backlog still supplies the ready-made candidate and the row count when
it has one.

**Correcting the line itself.** Every attribute in the drawer can be corrected in place
(`AttributeCorrection`): change a value the system read wrong, **remove** one the piece does not
carry, or write one it never saw. This is SPEC-015 — a *label*, not a rule — and the drawer keeps
the two apart on purpose: a vocabulary entry says "whenever this appears, read it like this" and
moves every MTO; a correction says "on this row, this datum is this" and moves nothing else. A
correction can become a rule, but by the long road (approval plus regression against the gold),
never by the shortcut of typing in a cell.

Three properties it does not give up:
- **Literal evidence.** The server refuses any correction whose evidence is not in the row verbatim
  (`proposeCorrection`), and the panel checks it as you type so the refusal is not a surprise. Both
  use the same function (`src/eval/history/evidence.ts`) — written twice, the two copies drift and
  the form starts blessing what the server rejects.
- **A mandatory reason.** Emptying a cell is an assertion — *this piece carries no quality* — not a
  gap, and it is reviewable only if it says why.
- **Its own provenance.** A corrected value reads `corregido a mano` (`human_corrected`), never as
  something the MTO said. It is the most trustworthy source in the list and the one the system can
  least explain, which is exactly why it is visible.

**Blocking versus tuning, and why the drawer says which.** A resolved line can still have something
worth teaching the system, and calling that a *pending decision* is a lie about the line's state.
Line 24.1 of the suggestions MTO is the case: quality `GR B16` sits outside the §5 catalogue — and
§5 says to keep verbatim what it does not list — its material derives to `AC`, and it carries all
seven attributes. It is RESOLVED, correctly. Offering to declare its group is useful; announcing it
in the queue as pending is not, and it contradicted the KPI panel, which does not count it because
there is no gap.

So a decision is **blocking** when the project owes one there (a backlog gap on that attribute) or
when that attribute is the line's reason for review; otherwise it is **tuning**. Both are offered in
the drawer, under different headings; only blocking ones get the per-line hint in the queue. The
invariant — *a resolved line never carries a blocking decision* — is pinned in
`app/lib/__tests__/line-decisions.test.ts`, having been broken twice: once as state (fixed by P-13)
and once as wording.

They also share the same panel (`VocabAddPanel`): editable text, live preview of what the system
already knows about that value, the decision with its options spelled out, reason, evidence, and
the id that will end up in the purchase trace. Quality and material used to be a bare `<select>`,
which is not a cosmetic gap — a decision saved without its reason cannot be reviewed six months
later, and without the preview the buyer cannot tell they are about to re-decide something already
decided. Material gained the third exit its own gap text always promised: **not derivable, with its
reason** — the twin of finish's "this is not a finish".

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
(`FinishVocabAddPanel`, inside the line's drawer). Accepting a suggestion saves the decision to the
vocabulary, rewrites and accepts all matching cases in the currently open MTO, and keeps it active
for future MTOs (SPEC-013). The screen's patch lives in the session; it does not mutate the pipeline's already
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
- [x] Every vocabulary decision (quality, material, finish) is taken from the line's drawer. The
      "How it went" panel counts them and holds no form.
- [x] A line with a pending decision says so in the queue, naming the attribute.
- [x] Quality, material, and finish are added from the line with the **same** panel and the same
      trigger. No attribute depends on the backlog having spotted it first.
- [x] Any attribute can be corrected, removed, or filled in from the drawer, with literal evidence
      and a reason, and the line shows the result as `corregido a mano`.
- [x] A **resolved** line never shows a pending decision or a queue hint. What it can still teach the
      system is offered as tuning, and says so.
- [x] When there is **nothing** pending on a value that looks unfinished — a quality outside the §5
      catalogue, an empty material — the drawer says why and still offers the vocabulary link. "No
      option to decide" is never the answer; see `OpenEnds` in `LineDecisions.tsx`.

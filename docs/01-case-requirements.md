# Case requirements

Extracted from `data/input/Case técnico AI Engineer..pdf` (6 pages) and
`data/input/reglas_tornilleria.md`.

## 1. Context

- **Client**: Asturian EPC firm, ~€400M revenue, €5–80M projects.
- **Volumes**: MTOs of up to **20,000 rows**, **15–25% fasteners**, up to **25 revisions**
  per project.
- **Human baseline**: 6 procurement staff, **~90 s/row** if the row is clean, more if not.
- **Bottleneck**: extraction + normalization. What comes after (family → supplier → RFQ) is
  "the easy part."

### Asymmetric cost of error — the axis of the KPI

| Error | Cost |
|---|---|
| **False resolved** (a poorly extracted row given a pass) | 3–8 weeks of delay on the construction front + milestone penalty on some contracts. |
| **False to review** (a correct row sent for review) | Doesn't break anything, but doesn't save hours either, and **if the queue fills up with noise the buyer stops looking at it**, which also degrades protection against the first error. This is the "invisible failure," and it accumulates across 25 revisions. |

## 2. Functional scope

One family: fasteners. **Seven attributes**: Name/Description, Material, Quality, Measure,
Length, Standard, Finish.

**Two output states per line**:
- `RESUELTA` (RESOLVED) — all seven attributes normalized.
- `REVISION_MANUAL` (MANUAL_REVIEW) — a mandatory attribute is missing or there's an
  inconsistency, **with the reason**.
- Explicit requirement: distinguish *"the MTO doesn't provide the data"* (goes back to
  engineering, no model fixes it) from *"my system isn't sure."*

**Set explosion** (the costliest rule):
- One row = one functional set → **one output line per element**, with **different quantities
  per element**.
- Only **the measure is extrapolated**. Quality **is not**: a set can carry an A4-70 bolt and an
  A4-80 nut, so an element without a quality grade → review.
- **Sets are not completed by convention**: a stud bolt with no nuts mentioned → a single line.

**Mandatory fields and catalogs**:
- Length is mandatory for all fasteners **except nuts and washers**.
- A blank finish is valid and **does not** send the line to review. But **items with a finish and
  without a finish are never mixed**: they're different materials.
- Measure: inches and metric are **not** equivalent.
- Closed tables to apply: 14 quality equivalence groups (G1–G14), 25 DIN→ISO/EN equivalences,
  7 finishes with aliases, 5 normalized names.
- **Documented trap**: the Excel's `MATERIAL` column almost never contains a material — it
  contains a quality grade or a standard+grade. *The column name is not the attribute.*

## 3. KPI — defined by the candidate

Four things required (the PDF says "three" and lists four):

1. **What you measure against.** There are no labels. How the reference is built, with how many
   rows, and why you trust it. *"The client doesn't have a single well-resolved MTO in the whole
   company."*
2. **What you measure and why**, with exact definitions. Plain accuracy is ruled out: 100%
   correct with 90% sent to review doesn't work; 100% resolved with 85% correct is **worse than
   nothing**.
3. **What number you commit to with this client**, with the argument (volumes, 90 s/row,
   the cost of the two errors).
4. **Where you set the resolved/review threshold and why there** — *"the most important decision
   in the case, and it's a business decision, not a technical one."*

**Also measured**: cost per row in €, latency for 1,000 rows, breakdown by attribute.

> ⚠️ The sentence *"a KPI that doesn't distinguish between the two errors in section 1 is a good
> KPI"* is almost certainly a typo for *"is not a good KPI"*: it contradicts all of section 1.
> The correct reading is assumed, and it's mentioned in passing during the session. No question
> is spent on it.

## 4. Deliverables

| Deliverable | Requirements |
|---|---|
| **Runnable system** | **Agents + front end**. Explicitly NOT slides, NOT a notebook, NOT a diagram. Starts up on your own machine while screen-sharing. **Verify a cold start.** Preferred stack: Python or Node.js + Next.js/React. |
| **Front end** | "Give it some care, it's the first thing people see." User = a buyer who receives the MTO on Monday and gets the RFQs out that same week. **If they have to open an Excel file alongside it, it's not good enough.** |
| **2-pager** | Maximum 2 pages, 6 timed sections (below). |
| **Session** | 60 minutes: 20' live demo, 10' 2-pager, 30' discussion and challenge. |

**The 2-pager's 6 sections**:
1. The problem as understood + proposed KPI, with the argument to defend it.
2. The **agent-to-agent** solution: what it does, why it exists, and **what happens to the KPI if
   it's removed** ("if you don't know what happens when you remove it, you don't know why it's
   there").
3. Results against the KPI **and where it fails**, with a breakdown by attribute. "Show us the
   rows that fell through."
4. **The target solution**: what would be built with no time limit, how it differs, what KPI
   delta it buys and at what cost. *"It tells us whether you can tell a demo apart from a
   deployable solution."*
5. **What was decided not to do, and why** ("a case without this section is a case where nothing
   was decided").
6. **What breaks in production**: the 3 real risks.

## 5. Rules of the game

- **5 calendar days**, with 5–10 hours of actual work as the reference. If more is spent, it must
  be disclosed.
- **2-pager + repo link: 24 hours before the session.**
- Runs locally; no need to deploy. **Verify it starts up cold.**
- Synthetic, anonymized data → any model or service allowed.
- **Maximum 3 questions per email.** See `client-questions/`.
- **Blind set: 12 new rows run live** during the challenge, and you'll be asked for **the trace
  of specific rows**. Design consequence: optimizing against the 15 given rows is pointless, and
  per-attribute traceability is a day-1 requirement, not an extra.

## 6. Evaluation criteria

1. **How you arrive at the architecture, more than the architecture itself** — "knowing how many
   agents are needed, of what type, and why, to reach a committed number. That's 90% of the
   work."
2. **Whether you know when an agent is NOT needed** — "putting a model where a table would do is
   just as bad a call as the opposite, and it costs you too."
3. **How you measure**, and whether you understand your number well enough for people to believe
   it.
4. **How you own problems that aren't technically yours**: a messy materials master, two buyers
   who don't normalize the same way, nobody has measured the human error rate.

## 7. Deliberate ambiguities

Section 10 of the rules: 6 points left deliberately open. Decisions in `03-policies.md`;
the three that were asked about, in `client-questions/`.

Additional contradiction detected, not listed by them: section 5 of the rules says *"if the
Quality field is missing, the item is classified as manual review"* and two lines later *"if it
isn't entered, the element is allowed to be created without a quality grade."* This is reconciled
as two distinct moments: the system sends it to review, and the person decides whether to create
the element without a quality grade. The front end implements exactly that.

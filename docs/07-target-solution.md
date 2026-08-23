# The target solution

> Status: ✅. Feeds section 4 of the 2-pager: what I'd build with no time constraint, what KPI
> delta each thing buys, and what it costs.

Ordered by **KPI delta per hour invested**, not by technical interest. The first five came
from measuring, not from imagining: each one has a number behind it that's already been taken.

---

## The five I'd buy first, and why in this order

### 1. The deterministic filter before the model · **low cost, 5× cost delta**

A row with none of the catalog's names isn't fastener hardware and doesn't need a call to the
model. Today only rows with no text are short-circuited, so a flange still pays for its call and
comes back with `outOfFamily: true`. And to know which 4,000 of the 20,000 rows are fastener
hardware, you have to read all 20,000: **500,000 reads per site, not 100,000**.

| | Value |
|---|---|
| Measured on the 79 rows we have | **0 false negatives · 0 false positives** |
| Cost delta | €48 → ~€10 per site with the chosen model; **€8,750 → €1,750** with `gpt-5.5` |
| Cost to build | Low. It's `findNames` plus a guard |

**Why it isn't built yet**, which is the interesting part: it moves the out-of-family verdict
from the model to a table in 80% of cases, and that changes the semantics of P-9. The failure mode
is a fastener-hardware row written with an alias not in the table: **it doesn't disappear** — it
comes out as `OUT_OF_FAMILY` in the separate queue — so it costs a review, not a purchase. Still, it's
a product decision and deserves its own measurement, not a patch. A filter by name **or standard**
doesn't work: the flange in row 56 carries `ASTM A105`, the standards regex recognizes it and would
pay for the call again.

### 2. Fail closed: the gap blocks, it doesn't just accompany · **low cost, structural delta**

Today a policy gap is reported **alongside** a line that has already been resolved by default. It's
halfway there: the gap is visible, but the material has already gone out to the RFQ.

The *"being 100% sure"* the client asks for is only structural if the gap **blocks** resolution.
It's the difference between a system that warns and a system in which it simply can't happen.

Measured delta available: 0 gaps on the given MTO, **17 across 8 rows** of the synthetic set. Those
are the rows that today come out resolved with a warning next to them and should come out unresolved.

### 3. Stable line identity, independent of the file's columns · **low-to-medium cost**

This came from measuring the format variants: a line's identity comes from the `ITEM` column, which
is **optional**. In the variant without it, `itemRef` falls back to the Excel row number. Insert a
row in revision 12 and every identifier below it shifts.

That breaks exactly the brief's most expensive use case — *"you can't tell that revision 12 orders
two thousand bolts already purchased in revision 9"* — because the diff needs stable material
identity, not row identity. Identity has to come from **normalized content** (the seven
attributes), not from position in the sheet.

### 4. Rules as data: a two-layer vocabulary and a policy console · **medium cost, delta in adaptation speed**

Today the tables are TypeScript and the policies are an object with flags. A versioned vocabulary,
with **who / when / why** per entry, turns *"changing a rule"* into an auditable data change
instead of a deployment. The client can read a table; they can't read a `.ts` file.

Part of this is already done: material derivation moved out of code into SQLite with an
append-only log in git (`src/rules/vocabulary-db.ts`). What's missing isn't *copying that to the
other six attributes*, and that distinction is the part that matters.

**Why material was first, and why that doesn't generalize as-is.** Material is in a database
because **deriving it is our own opinion** (P-3), and an opinion needs an author. The other
attributes aren't in that situation: name, grade, standard, and finish **already have a closed
client table**. Putting everything in the same database would mix *"what their document says"*
with *"what we decided,"* which is exactly the distinction the `provenance` field
(`exact_catalog` / `table_normalized` versus `derived`) and the invariant in `03-policies.md` rest
on.

So two layers, separated on purpose:

| Layer | Contents | Who edits it | Provenance |
|---|---|---|---|
| **1 · Client catalog** | The 5 names, the 14 grade groups, the 25 DIN→ISO equivalences, the 7 finishes | Nobody from the UI. It's their document; if it changes, it changes version | `reglas_tornilleria.md §N` |
| **2 · Aliases and our own decisions** | What their document doesn't list: `ZP`, `HDG`, *"vis à tête"*, a 26th DIN, `GR B7 → AC` | The client, from the front end, with the material vocabulary's guardrails | `vocab:<id>` + who/when/why |

The separation matters more than the extent: it answers *"who decided this?"* **per attribute**,
which is exactly the trace they ask for in the challenge.

**Which attributes go into layer 2, in order of what they buy — and which don't.**

| Attribute | Layer 2? | Why |
|---|---|---|
| **Name** | Yes, the first | It's the gate to everything else: out-of-family verdict, mandatory fields, grade/type coherence. And it's **the only place where the model's guess still wins today** when the table misses (`normalize.ts:63`) — exactly where it's been measured to get it wrong ("STUD BOLT" → VARILLA ROSCADA). Synthetic rows 60 and 61 are French and Portuguese |
| **Finish** | Yes, the cheapest | 7 values and the aliases are pure studio and supplier jargon (`ZP`, `YZP`, `BL`, `HDG`). §9 says items with and without finish aren't mixed, so an unrecognized alias **changes the material being purchased**, not a label |
| **Standard** | Yes, medium | Its rule already covers the gap (a DIN not in the table is kept as-is), so there's no bleeding here. What layer 2 buys are **new** equivalences |
| **Grade** | Yes, last, and with a signature | Adding a grade here isn't normalizing: it's **declaring two things interchangeable**. `A2-80` is not `A2` — that's why G2 is isolated. This is decided by someone who can answer for a substitution, not a buyer with a three-field form |
| **Size** and **Length** | **No** | This isn't vocabulary, it's a grammar. P-10 is the proof: it needed a **shape** rule (§6: `M` or inch marks), not a table of values. A list of aliases here would be endless and would fix nothing |

That last row is the one I'd defend in the session: four yeses, two nos, with the reason. Putting a
table where a grammar was needed is the same error of judgment as putting a model where a table
would do, just in the other direction.

**What it costs, which isn't free.** Every new axis needs the ambiguity guardrail material already
has — rejecting an entry that would make a grade that resolves today ambiguous — and a new one
appears that doesn't exist today: **cross-attribute ambiguity**, a token that's an alias for finish
and for grade at the same time. Today each table scans independently. And an editable vocabulary is
a new silent-failure channel: one bad entry applies to **all** subsequent MTOs. The mitigation is
cheap because the pieces already exist: **an entry doesn't take effect until it passes the gold
set**.

#### The other half: policies, which are not vocabulary

A vocabulary decides **values**; a policy decides **behavior**. The full taxonomy is in
`03-policies.md`, and what matters here is the consequence: **they aren't approved the same way, so
they can't be the same screen.** What makes a vocabulary entry approvable is the ambiguity guardrail;
what makes a policy approvable is **the KPI delta**.

So the policy console isn't a form with eleven dropdowns. It's: you change P-5 →
it runs against the gold → *"moves 2 of 101 lines from review to resolved; silent error +0;
queue noise +X"* → you approve or discard, and the change lands in the same append-only log as the
vocabulary, with author and reason.

**What's already there** (done on 2026-08-22, see `03-policies.md` §"The flags actually work"):
flags actually switch, an invalid value blows up instead of falling to the default, and every run
declares which policies aren't the defaults. Before that, `.env.example` documented ten `POLICY_*`
that nobody read.

**What's missing**: computing the delta against the gold **within the run itself** instead of
analytically and separately (`scripts/sens.py`, which today only covers the 30 lines of the real
MTO), and recording the approval. The cost is low because the three pieces — gold, harness, and
sensitivity analysis — already exist; what's missing is joining them.

#### And the dimension policies are missing: scope

The eleven policies are **global**. The brief says part of the engineering is in-house and part is
outsourced, and that each one writes the same nut differently — so for some, the right scope isn't
the project, it's the **issuer**: *"studio A never writes the standard on threaded rods."* That's a
**convention**, not a policy, and it's what turns silent drift (risk #2) into something expected
instead of a surprise.

**And here's the price, which is why I wouldn't buy it yet:** per-issuer scope multiplies the
configuration surface and **breaks KPI comparability**. You go from having one number to having one
per studio, and the 2-pager's commitment is expressed as a single number. Before building it, you
have to decide what you're committing to when the system behaves differently depending on who
signed the MTO — and that's a business conversation, not an architecture one.

### 5. Approvable suggestions in the queue, instead of just reasons · **low-to-medium cost, delta in queue noise**

Today a line in review says *what's* wrong with it. It doesn't say *what it would take to fix it*,
and in some cases the system knows.

**This one isn't a hypothesis: it has a measured case from this week.** Row 63 came out with
`QUALITY_MISSING` and the grade was written in the row — the `10` in `tuerca DIN 934 10`, which the
extractor had put in the size field. We were asking engineering for data they already had written
down. It's a **false non-resolve**, and it's exactly the noise the brief calls the invisible
failure.

It's also the writing path for layer 4's vocabulary: approving a suggestion is how layer 2 grows
without anyone writing JSON. `VocabQuickAdd` is already the prototype, just that today it lives in
the results panel and not in the line.

**The edge, and it's the edge of the whole case.** A suggestion is the cheapest path that exists from
the safe error to the costly error: one click turns a false non-resolve into a resolve. So the
design has to make it impossible for a suggestion to resolve itself. Three cases, and only one
deserves a suggestion:

| Situation | What the system does |
|---|---|
| The table can decide | **Resolve, don't suggest.** That's what P-11 does. A suggestion here is a click that buys nothing and trains the buyer to click without looking |
| The table can't decide, but the row carries the evidence | **Suggest**, with the span highlighted, and require approval |
| The data isn't in the row | **Never suggest** |

From that comes a hard rule: **suggestions only in the buyer's queue, never in engineering's.** That
queue is by definition for data nobody wrote; suggesting a value there is inventing with a consent
form in front of it. And it has a second-order effect I like: it turns P-9's queue separation into
something that **carries weight**, not just a label.

Two more conditions:

- **The suggestion must come from a closed table or from the row's own text, never from a free-form
  call to the model.** Otherwise you've built a machine that says *"I'm not sure… but click here to
  be sure."*
- **It needs its own KPI or in three weeks it's an auto-resolve button.** Two numbers, measured
  **separately** from the lines the system resolves: the **acceptance rate** — near 100% means
  either it should have been a rule, or people approve without looking; near 0% means the
  suggester is noise — and the **silent error rate of lines approved via suggestion**. If they can't
  be separated from the rest, neither figure can be defended.

And an interface detail with a real effect: the suggestion changes what the buyer sees **before**
deciding, and that buyer is the safety net. Evidence in the row first, proposed value after. Never
the other way around.

**Expected delta.** From what's measured: 1 of the 18 lines sent to review in the synthetic set was
a false non-resolve recoverable via table (already fixed by P-11, no suggestion needed). The
candidates for suggestion are the 3 `STANDARD_MISSING` and part of the 6 `QUALITY_MISSING` — but
**the honest number here I don't have**, because knowing how many of those have a candidate with
evidence requires the detector, and it isn't built. What I can promise is the shape of the
measurement, not its value.

---

## The three that buy more money but aren't mine yet

| # | What | What it buys | Cost |
|---|---|---|---|
| 6 | **The front end as a ground-truth generator.** Every buyer correction is a label, with who and when | Turns the KPI from an estimate over 30 lines into a continuous measurement over thousands. **Unlocks everything else**, including knowing whether the other risks are actually happening | Low. It's a log and a view |
| 7 | **Matching against the material master and supplier catalogs.** Normalizing isn't the end: the buyer needs the reference | Eliminates the subsequent manual step, which the brief calls "the easy part" but is still work | Medium. Depends on the master data's quality, which is the client's problem, not mine |
| 8 | **Diff between revisions.** *"Revision 12 orders two thousand bolts already purchased in revision 9"* | Probably **the biggest financial saving in the entire project**, and no part of this case addresses it | Medium-high, and **depends on item 3**: without stable identity there's no diff |

---

## What today's measurement added to this list, and wasn't there on day 0

Worth stating separately, because it's the argument that measuring is cheap:

| New item | What uncovered it |
|---|---|
| 1 · deterministic filter | Doing the cost multiplication with the correct denominator |
| 3 · stable identity | Running the full pipeline through the 10 format variants |
| **Separating a policy gap from an incomplete split** | Both came out as `UNPLACED_EVIDENCE` with different recipients |
| **Union of N critic passes** | Rerunning the critic and watching recall vary 14% → 71% on the same input |
| **Repetitions as part of the harness, not as an exception** | The split for hard rows fails ≈1 run in 4, and a single pass doesn't see it |
| **5 · approvable suggestions** | Reviewing a quantity in row 63 and finding a false non-resolve: the grade was written and we were asking engineering for it |
| **4 · the two-layer vocabulary** | Asking whether the material vocabulary would generalize to the other six attributes. The useful answer wasn't "yes" or "no," it was *where the boundary is*: four yes, two no, because size and length are grammar, not vocabulary |

The last two are the same lesson wearing two faces: **this system has stochastic
components, and a single measurement doesn't tell you whether a change worked.** The harness has
to assume that by default instead of treating repetition as a separate experiment.

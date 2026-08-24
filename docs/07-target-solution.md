# The target solution

> Status: ✅. Feeds section 4 of the 2-pager: what I'd build with no time constraint, what KPI
> delta each thing buys, and how much it costs.

Ordered by **KPI delta per hour invested**, not by technical interest. The first five came from
measuring, not from imagining: each one has a number behind it that's already been captured.

---

## The five I'd buy first, and why in this order

### 1. The deterministic filter before the model · **low cost, 5× delta in cost**

A row with none of the catalog's names isn't a fastener and doesn't need a model call. Today only
rows with no text get short-circuited, so a flange pays for its call and comes back with
`outOfFamily: true`. And to know which 4,000 of the 20,000 rows are fasteners, you have to read all
20,000: **500,000 reads per project, not 100,000**.

| | Value |
|---|---|
| Measured on the 79 rows we have | **0 false negatives · 0 false positives** |
| Cost delta | €48 → ~€10 per project with the chosen model; **€8,750 → €1,750** with `gpt-5.5` |
| Cost to build | Low. It's `findNames` plus a guard |

**Why it isn't already done**, which is the interesting part: it moves the out-of-family verdict
from the model to a table in 80% of cases, and that changes the semantics of P-9. The failure mode
is a fastener row written with an alias that isn't in the table: **it doesn't disappear** — it
comes out as `OUT_OF_FAMILY` in a separate queue — so it costs a review, not a purchase. Still, it's
a product decision and deserves its own measurement, not a patch. A filter by name **or standard**
doesn't work: the flange in row 56 carries `ASTM A105`, the standards regex recognizes it, and it
would pay for the call again.

### 2. Fail closed: the gap blocks, it doesn't just accompany · **low cost, structural delta**

Today a policy gap is reported **alongside** a line that's already been resolved by default. It's
halfway there: the gap is visible, but the material has already headed to the RFQ.

The *"100% certain"* the client asks for is only structural if the gap **blocks** resolution. It's
the difference between a system that warns and a system in which it simply can't happen.

Available measured delta: 0 gaps in the given MTO, **17 across 8 rows** in the synthetic set. Those
are the rows that today come out resolved with a warning next to them and should come out
unresolved instead.

### 3. Stable line identity, independent of the file's columns · **low-to-medium cost**

This came from measuring the format variants: a line's identity comes from the `ITEM` column,
which is **optional**. In the variant without it, the `itemRef` falls back to the Excel row number.
Insert a row in revision 12 and every identifier below it shifts.

That breaks exactly the most expensive use case in the brief — *"you can't see that revision 12
requests two thousand bolts that were already purchased in revision 9"* — because the diff needs
stable identity of the material, not of the row. Identity has to come from the **normalized
content** (the seven attributes), not from position on the sheet.

### 4. Rules as data: two-layer vocabulary and a policy console · **medium cost, delta in adaptation speed**

Today name, quality, and standard still live in TypeScript (client catalog, read-only in the UI)
and policies are an object with flags. A versioned vocabulary, with **who / when / why** per entry,
turns *"changing a rule"* into an auditable data change instead of a deployment.

**What's already done.** Material (`vocabulary-db.ts`, P-3) and finish (`finish-db.ts`, SPEC-011)
are data: SQLite + a git log, extendable from **a single view** (`/vocabulario`, SPEC-012). P-12
fails closed on an unknown finish. Suggestions have their own KPI (SPEC-013); the front end applies
them within the session and doesn't yet persist them.

**What's missing** isn't *copying that to the other four attributes*, and that distinction is the
part that matters.

**Why material came first, and finish second.** Material is in a database because **deriving it
is our own opinion** (P-3). Finish came next because it was the only closed catalog that **was
failing silently** (P-12). Name, quality, and standard **already have a closed client catalog** and
an escape hatch for the unknown: they're listed in the view, but not yet editable. Putting the
client's catalog and our own decisions in the same table without layers would mix *"what their
document says"* with *"what we decided."*

So, two layers, deliberately separated:

| Layer | Content | Who edits it | Provenance |
|---|---|---|---|
| **1 · Client catalog** | The 5 names, the 14 quality groups, the 25 DIN→ISO equivalences, the 7 finishes | No one from the UI. It's their document; if it changes, it gets a new version | `reglas_tornilleria.md §N` |
| **2 · Our aliases and decisions** | What their document doesn't list: `ZP`, `HDG`, *"vis à tête"*, a 26th DIN, `GR B7 → AC` | The client, from the front end, with the material vocabulary's guards | `vocab:<id>` + who/when/why |

The separation is worth more than the extension: it answers *"who decided this?"* **per
attribute**, which is exactly the trace the challenge asks for.

**Which attributes go into layer 2, ordered by what they buy — and which don't.**

| Attribute | Layer 2? | Why |
|---|---|---|
| **Name** | Yes, the first one | It's the gateway to everything else: out-of-family verdict, requirements, quality/type coherence. And it's **the one place where the model's guess still wins today** when the table misses (`normalize.ts:63`) — exactly where it's measured to get it wrong ("STUD BOLT" → VARILLA ROSCADA). Rows 60 and 61 of the synthetic set are French and Portuguese |
| **Finish** | Yes — **layer 2 already in production** (SPEC-011) | 7 values, and the aliases are workshop and supplier jargon. An unrecognized alias **changes the part being purchased**. P-12 sends it to review |
| **Standard** | Yes, partially | Its rule already covers the gap (an out-of-table DIN is kept as-is), so there's no bleeding here. What layer 2 buys are **new** equivalences |
| **Quality** | Yes, the last one, and with a signature | Adding a quality grade here isn't normalizing: it's **declaring two things interchangeable**. `A2-80` is not `A2` — that's why G2 is isolated. It's decided by someone who can answer for a substitution, not a buyer with a three-field form |
| **Size** and **Length** | **No** | It's not vocabulary, it's a grammar. P-10 is the proof: it needed a **shape** rule (§6: `M` or inches marks), not a table of values. A list of aliases here would be infinite and wouldn't fix anything |

That last row is the one I'd defend in the session: four yes, two no, with the reason. Putting a
table where a grammar was needed is the same judgment error as putting a model where a table was
enough, just in the other direction.

**What it costs, which isn't free.** Every new axis needs the ambiguity guard material already
has — rejecting an entry that would make ambiguous a quality that currently resolves — and a new
one shows up: **cross-attribute ambiguity**, a token that's an alias for finish and for quality at
the same time. Today each table scans on its own. And an editable vocabulary is a new silent-failure
channel: one bad entry gets applied to **every** subsequent MTO. The mitigation is cheap because
the pieces already exist: **an entry doesn't take effect until it passes the gold set**.

#### The other half: policies, which aren't vocabulary

A vocabulary decides **values**; a policy decides **behavior**. The full taxonomy is in
`03-policies.md`, and what matters here is the consequence: **they aren't approved the same way,
so they can't be the same screen.** What makes a vocabulary entry approvable is the ambiguity
guard; what makes a policy approvable is **the KPI delta**.

So the policy console isn't a form with twelve dropdowns. It's: you change P-5 → it runs against
the gold → *"moves 2 lines out of 101 from review to resolved; silent error +0; queue noise +X"* →
you approve or discard it, and the change lands in the same append-only log as the vocabulary,
with a reason.

**What's already done** (as of 2026-08-22, see `03-policies.md` §"The flags actually work"): the
flags really do toggle, an invalid value blows up instead of silently falling back to a default,
and every run declares which policies aren't the standard ones. Before that, `.env.example`
documented ten `POLICY_*` variables that nobody read.

**What's missing**: computing the delta against the gold **within the run itself** instead of
analytically and separately (`scripts/sens.py`, which today only covers the 30 lines of the real
MTO), and logging the approval. The cost is low because the three pieces — gold, harness, and
sensitivity analysis — already exist; what's missing is joining them.

#### And the dimension policies are missing: scope

The twelve are **global**. The brief says part of the engineering is in-house and part is
outsourced, and that each one writes the same nut differently — so for some of them the right
scope isn't the project, it's the **issuer**: *"engineering firm A never writes the standard on
threaded rods."* That's a **convention**, not a policy, and it's what turns silent drift (risk #2)
into something expected instead of a surprise.

**And here's the price, which is why I wouldn't buy it yet:** per-issuer scope multiplies the
configuration surface and **breaks KPI comparability**. You stop having one number and end up with
one per engineering firm, and the 2-pager's commitment is expressed as a single number. Before
building it, you have to decide what you're committing to when the system behaves differently
depending on who signed the MTO — and that's a business conversation, not an architecture one.

### 5. Approvable suggestions in the queue, instead of just reasons · **low-to-medium cost, delta in queue noise**

Today a line under review says *what's* wrong with it. It doesn't say *what it would take to fix
it*, and in some of the cases the system knows.

**This line isn't a hypothesis: it has a measured case from this week.** Row 63 came out with
`QUALITY_MISSING` and the quality was written in the row — the `10` in `tuerca DIN 934 10`, which
the extractor had put in the size field. We were asking engineering for data they'd already
written. It's a **false unresolved**, and it's exactly the invisible-failure noise the brief talks
about.

It's also the vocabulary's write path: approving a suggestion is how layer 2 grows without anyone
writing JSON by hand. **What's already done:** creation from `/vocabulario` and from the queue
(finish and material), rewriting within the session, fail-closed until validated, its own KPI
(`pnpm run suggestions:kpi`). **What's missing:** persisting SHOWN/ACCEPTED from the front end
(SPEC-013) and the `STANDARD_MISSING` detector with in-row evidence.

**The edge, and it's the edge of the whole case.** A suggestion is the cheapest path there is from
a safe error to a costly one: one click turns a false unresolved into resolved. So the design has
to make it impossible for a suggestion to resolve itself. Three situations, and only one deserves a
suggestion:

| Situation | What the system does |
|---|---|
| The table can decide | **Resolve, don't suggest.** That's what P-11 does. A suggestion here is a click that buys nothing and trains the buyer to click without looking |
| The table can't decide, but the row carries the evidence | **Suggest**, with the span highlighted, and require approval |
| The data isn't in the row | **Never suggest** |

That leads to a hard rule: **suggestions only in the buyer's queue, never in engineering's.** That
queue is by definition the one for data nobody wrote; suggesting a value there is inventing it with
a consent form in front of it. And it has a second-order effect I like: it turns P-9's queue
separation into something that **carries weight**, not just a label.

Two more conditions:

- **The suggestion has to come from a closed table or from the row's own text, never from a free
  call to the model.** Otherwise you've built a machine that says *"I'm not sure… but click here to
  be sure."*
- **It needs its own KPI or in three weeks it's an auto-resolve button.** Two numbers, measured
  **separately** from the lines the system resolves: the **acceptance rate** — near 100% means
  either it should have been a rule, or people are approving without looking; near 0% means the
  suggester is noise — and the **silent error rate of lines approved via suggestion**. If these two
  can't be separated from the rest, neither number can be defended.

And one interface detail with a real effect: the suggestion changes what the buyer sees **before**
deciding, and that buyer is the safety net. Evidence in the row first, proposed value after. Never
the other way around.

**Delta.** P-11 already closed the false unresolved from row 63 (no suggestion needed: it was a
rule). Finish and material suggestions exist; their KPI is 0/0 until a buyer decides, and that's
the honest number. The candidates that **still** have no detector are the `STANDARD_MISSING` ones
with in-row evidence: that's where the detector is actually missing, and I'm not making up the
count.

---

## The three that buy more money but aren't mine yet

| # | What | What it buys | Cost |
|---|---|---|---|
| 6 | **The front end as a ground-truth generator** (SPEC-015). Every correction is a label; two different values for the same cell are a vocabulary decision, not a model bug. It's not RL. There's no login | Turns the KPI from an estimate over 30 lines into a continuous measurement. **Unlocks case criterion 4** | Low. Contract written; needs UI → `proposeCorrection` and the promotion orchestrator |
| 7 | **Matching against the materials master and supplier catalogs.** Normalizing isn't the end: the buyer needs the actual reference | Eliminates the manual downstream step, which the brief calls "the easy part" but is still work | Medium. Depends on the master's quality, which is the client's problem, not mine. **Still out of scope** |
| 8 | **Diff between revisions** (SPEC-014). *"Revision 12 requests two thousand bolts already purchased in revision 9"* | The biggest savings in the brief that **doesn't** enter the extraction KPI | Done: `RevisionStore` + `/mto-history/compare`. "Already purchased" only if `RESUELTA` **and** exported to RFQ |

---

## What today's measurement added to this list, and wasn't there on day 0

Worth saying separately, because it's the argument that measuring is cheap:

| New line | What uncovered it |
|---|---|
| 1 · deterministic filter | Doing the cost multiplication with the correct denominator |
| 3 · stable identity | Running the full pipeline through the 10 format variants |
| **Separating policy gap from incomplete split** | Both were coming out as `UNPLACED_EVIDENCE` with different intended recipients |
| **Union of N critic passes** | Repeating the critic and watching recall swing 14% → 71% on the same input |
| **Repetitions as part of the harness, not as an exception** | The split for hard rows fails ≈1 run out of 4, and a single pass doesn't show it |
| **5 · approvable suggestions** | Reviewing a quantity in row 63 and finding a false unresolved: the quality was written and we were asking engineering for it |
| **4 · the two-layer vocabulary** | Asking whether the material vocabulary generalized to the other six attributes. The useful answer wasn't "yes" or "no," it was *where the boundary sits*: four yes, two no, because size and length are grammar, not vocabulary |

The last two are the same lesson wearing two faces: **this system has stochastic components, and
a single measurement doesn't tell you whether a change worked.** The harness has to assume that by
default instead of treating repetition as a separate experiment.

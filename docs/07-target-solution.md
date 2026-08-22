# The target solution

> Status: ✅. Feeds section 4 of the 2-pager: what I'd build with no time constraint, what KPI
> delta each thing buys, and how much it costs.

Ordered by **KPI delta per hour invested**, not by technical interest. The first four came from
measuring, not imagining: each one has a number behind it that's already been taken.

---

## The four I'd buy first, and why in this order

### 1. The deterministic filter before the model · **low cost, 5× cost delta**

A row with none of the catalog's names isn't fasteners and doesn't need a model call. Today only
rows with no text are short-circuited, so a flange pays for its call and comes back with
`outOfFamily: true`. And to know which 4,000 of the 20,000 rows are fasteners, all 20,000 have to
be read: **500,000 reads per site, not 100,000.**

| | Value |
|---|---|
| Measured on the 79 rows we have | **0 false negatives · 0 false positives** |
| Cost delta | 48 € → ~10 € per site with the chosen model; **8,750 € → 1,750 €** with `gpt-5.5` |
| Cost to build it | Low. It's `findNames` plus a guard |

**Why it isn't built yet**, which is the interesting part: it moves the out-of-family verdict from
the model to a table in 80% of cases, and that changes the semantics of P-9. The failure mode is a
fastener row written with an alias that isn't in the table: it **doesn't disappear** —it comes out
as `OUT_OF_FAMILY` in its own separate queue— so it costs a review, not a purchase. Even so, it's a
product decision and deserves its own measurement, not a patch. A filter by name **or standard**
doesn't work: the flange in row 56 carries `ASTM A105`, the standards regex recognizes it, and it
would pay for the call again.

### 2. Fail closed: the gap blocks, it doesn't just tag along · **low cost, structural delta**

Today a policy gap is reported **alongside** a line that's already been resolved by default. That's
halfway there: the gap is visible, but the material has already gone out to the RFQ.

The *"being 100% sure"* the client asks for is only structural if the gap **blocks** resolution.
It's the difference between a system that warns and a system where it can't happen.

Available measured delta: 0 gaps in the given MTO, **17 across 8 rows** of the synthetic set. Those
are the rows that today come out resolved with a warning next to them and should come out
unresolved.

### 3. Stable line identity, independent of the file's columns · **low-to-medium cost**

This came up while measuring format variants: a line's identity comes from the `ITEM` column, which
is **optional**. In the variant without it, `itemRef` falls back to the Excel row number. Insert a
row in revision 12 and every identifier below it shifts.

That breaks exactly the most expensive use case in the brief —*"you can't see that revision 12 asks
for two thousand bolts that were already bought in revision 9"*— because the diff needs stable
identity for the material, not for the row. Identity has to come from the **normalized content**
(the seven attributes), not from the position on the sheet.

### 4. The vocabulary as versioned data · **medium cost, delta in adaptation speed**

Today the tables are TypeScript and the policies are an object with flags. A versioned
`vocabulary.json`, with **who / when / why** per entry, turns *"changing a rule"* into an auditable
data change instead of a deployment. The client can read a JSON file; a `.ts` file, no.

Part of this is already done: material derivation moved from code into a versioned vocabulary.
What's missing is the rest and, above all, letting the client propose an entry.

---

## The three that buy more money but aren't mine yet

| # | What | What it buys | Cost |
|---|---|---|---|
| 5 | **The front end as a ground-truth generator.** Every buyer correction is a label, with who and when | Turns the KPI from an estimate over 30 lines into a continuous measurement over thousands. **Unlocks everything else**, including knowing whether the other risks are happening | Low. It's a log and a view |
| 6 | **Matching against the materials master and vendor catalogs.** Normalizing isn't the end: the buyer needs the part number | Removes the manual step afterward, which the brief calls "the easy part" but is still work | Medium. Depends on the master's quality, which is the client's problem, not mine |
| 7 | **Diff between revisions.** *"Revision 12 asks for two thousand bolts already bought in revision 9"* | Probably **the biggest financial saving in the entire project**, and no part of this case addresses it | Medium-high, and **depends on line 3**: without stable identity there's no diff |

---

## What today's measuring added to this list, that wasn't there on day 0

Worth saying separately, because it's the argument that measuring is cheap:

| New line | What uncovered it |
|---|---|
| 1 · deterministic filter | Doing the cost multiplication with the right denominator |
| 3 · stable identity | Running the full pipeline through the 10 format variants |
| **Separating a policy gap from an incomplete split** | Both were coming out as `UNPLACED_EVIDENCE` with different recipients |
| **Union of N critic passes** | Repeating the critic and watching recall swing 14% → 71% on the same input |
| **Repetitions as part of the harness, not as an exception** | The split on hard rows fails ≈1 run in 4, and a single pass doesn't see it |

The last two are the same lesson with two faces: **this system has stochastic components, and one
measurement alone doesn't tell you whether a change worked.** The harness has to assume that by
default instead of treating repetition as a separate experiment.

# The system behind the rules

> Born out of Jeremie's response from 2026-08-22:
>
> *"I imagine the key is thinking about how to get the missing correct rules right to make sure
> this insurance is properly covered at scale. At the same time, no two MTOs are alike, they
> always have differences, so it helps to think about the system behind the rules, not just the
> rules."*

## 1. The problem, stated plainly

Policies P-1…P-9 are **rules**. And all of them have a default, and **a default fires silently**.

Faced with a case no policy covers, the pipeline picks the default and **resolves the line**. On
the MTO we were given that works, because the policies were written against it. On the next MTO
from another engineering study —and the client says no two are alike— it's a costly error delivered
with a machine's confidence.

The failure isn't that rules are missing. It's that **the system doesn't know when it's missing
them**.

A bigger rule set doesn't fix this: it only moves the boundary of silence. What's needed is for the
system to distinguish three situations where today it only sees two:

| Situation | Today | Should |
|---|---|---|
| Known, decided case | resolves, with provenance | same |
| Known, undecided case | review, with a typed reason | same |
| **Never-seen case** | **resolves by default, silently** | **policy gap: pending decision** |

## 2. A gap is not a data problem

That's where the main design decision comes from: **a gap doesn't go to the buyer's queue.**

A review tells the buyer *"look at this data."* A gap says *"this project owes someone a decision."*
They're different recipients, different cadences, and different actions, and mixing them turns the
buyer's queue into the dumping ground for both — which is exactly how it fills with noise, the
failure the brief calls invisible.

Three channels, not two:

```
RESOLVED line ─────────────────────► RFQ
review line · MISSING_IN_SOURCE ────► engineering   (the data is missing at the source)
review line · LOW_CONFIDENCE ───────► buyer         (the data is there, I'm not sure)
policy gap ──────────────────────────► decision backlog   ← the new channel
```

## 3. What's detected today, and why it's deterministic

Implemented in `src/pipeline/coverage.ts`. **Zero cost and runs on every row**, not on a sample,
because it uses the same closed tables that produce the no-model baseline.

### `UNPLACED_EVIDENCE` — the row says something the output doesn't account for

The row's deterministic inventory (names, standards, finishes) is compared against what the
produced lines carry. If the row mentions a standard and **no line carries it**, either an element
is missing or the standard was attributed to the wrong attribute.

**This catches the class of failure the span verifier can't see by construction.** When
`gpt-5.4-mini` put `ASTM F436` —a standard— into the washer's *grade* field, span verification
approved it, because the text really is in the row. Here it fails: the standard that should have
carried a line was left unplaced.

**Grades are not scanned**, on purpose. §5 is explicit: if it isn't known whether a value is marked
as a grade, it isn't extracted. A scanner over free text can't know that, so scanning grades would
manufacture gaps out of any loose number in the row.

### `UNKNOWN_VALUE` — an off-catalog value that also doesn't fit a known pattern

§5 says a value marked as a grade but off the list is extracted as-is. That rule was written with
`GR B7` and `GR 2H` in mind. A `45H`, or garbage, **also passes** through that door and gets
resolved. Now it's distinguished: whatever fits a known grade gets resolved; whatever doesn't is a
gap.

### What validates the mechanism

On its **first run** it found a real standards-parser bug, not a hypothetical case: in
`...2 nuts DIN 934 and 2 washers DIN 125...` (Spanish: `...2 tuercas DIN 934 y 2 arandelas DIN
125...`) the Spanish conjunction *"y"* was being swallowed as a suffix of the standard, producing
`DIN 934 Y`. The optional suffix existed for the two suffixed entries in §8 (`DIN 125 A`, `DIN 7981
C-H`) and accepted any letter.

Nobody had seen it in 86 tests or in the 8 models evaluated, because the mis-parsed standard still
looked like a standard. The gap detected it: **it stopped matching anything that carried a line.**

And the fix illustrates the principle: instead of listing conjunctions language by language, **the
table arbitrates** — a suffix is only kept if the suffixed designation exists in it.

## 4. What's missing for this to be a system and not a list

Detecting is half of it. The rest is designed and not built, and it's said as such.

**Vocabulary as data, not as code.** Today the tables are TypeScript and the policies are an object
with flags. A versioned `vocabulary.json`, with `who / when / why` per entry, turns "changing a
rule" into an auditable data change instead of a deployment. The client can read it; they can't read
a `.ts`.

**Fail closed.** A gap should **block** the default resolution, not accompany it. Today gaps are
reported alongside a line that has already been resolved by default. It's halfway there: the gap is
visible, but the line already went out. The "being 100% sure" the client asks for is only structural
if the gap blocks.

**The learning loop.** Every correction the buyer makes in the front end is a candidate vocabulary
entry. That log already exists in the front-end design; what's missing is closing the loop:
correction → proposed entry → decision → rule. With that, the client has the first gold set in the
company's history within three weeks — something that doesn't exist anywhere in the house today.

**The gap rate as a product metric.** It's the figure that makes the promise falsifiable. A new
study's first MTO has a high gap rate; it decays as decisions accumulate. That can be measured, and
the client can be told *"the system is learning your vocabulary, and here's the curve"* instead of
just promising it.

**Two more detectors, designed:** never-seen combinations (a washer with a hex-bolt standard) and
never-seen row shapes (more than N elements, two principals, an element with no name).

## 5. The honest limit

This does **not** make the system get the first MTO of a new study right.

What it does is make it fail **out loud** instead of silently, and make the cost of failing **a
review instead of a purchase**. It turns the unknown-unknown into a bounded, visible, and
decreasing cost.

That's the difference between a demo and something deployable, and it's the answer to what Jeremie
was asking: not a more complete rule set, but the mechanism by which the missing rules get
discovered, decided, and applied the same way the next time.

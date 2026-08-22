# The system behind the rules

> Born from Jeremie's reply on 2026-08-22:
>
> *"I imagine the key is thinking about how to get the missing rules right, to make sure this
> insurance is correct at scale. At the same time, no two MTOs are alike, they always have some
> difference, so it helps to think about the system behind the rules, not just the rules."*

## 1. The problem, stated plainly

Policies P-1…P-9 are **rules**. And every one of them has a default, and **a default fires
silently**.

Faced with a case no policy covers, the pipeline picks the default and **resolves the line**. On
the MTO we were given that works, because the policies were written against it. On the next MTO
from a different engineering firm —and the client says no two are alike— it's a costly error
delivered with a machine's confidence.

The failure isn't that rules are missing. It's that **the system doesn't know when they're
missing**.

A bigger rule set doesn't fix it: it just moves the boundary of the silence. What's needed is for
the system to distinguish three situations where today it only sees two:

| Situation | Today | Should |
|---|---|---|
| Known and decided case | resolves, with provenance | same |
| Known and undecided case | review, with a typed reason | same |
| **Never-seen case** | **resolves by default, silently** | **policy gap: pending decision** |

## 2. A gap isn't a data problem

That's where the main design decision comes from: **a gap doesn't go to the buyer's queue.**

A review tells the buyer *"look at this data."* A gap says *"this project owes someone a
decision."* They have different recipients, different cadences, and different actions, and mixing
them turns the buyer's queue into the dumping ground for both — which is exactly how it fills up
with noise, the failure the brief calls invisible.

Three channels, not two:

```
RESOLVED line ─────────────────────► RFQ
review line · MISSING_IN_SOURCE ────► engineering   (data missing at source)
review line · LOW_CONFIDENCE ───────► buyer         (data is there, not confident)
policy gap ──────────────────────────► decision backlog   ← the new channel
```

## 3. What's detected today, and why it's deterministic

Implemented in `src/pipeline/coverage.ts`. **Zero cost and runs on every row**, not on a sample,
because it uses the same closed tables that give the no-model baseline.

### `UNPLACED_EVIDENCE` — the row says something the output doesn't explain

The row's deterministic inventory (names, standards, finishes) is compared against what the
produced lines carry. If the row mentions a standard and **no line carries it**, either an element
is missing or the standard was attributed to the wrong attribute.

**This catches the class of failure the span checker can't see by construction.** When
`gpt-5.4-mini` put `ASTM F436` —a standard— into the washer's *quality* field, the span check
approved it, because the text really is in the row. Here it fails: the standard that should have
been carried was left unplaced.

**Qualities aren't scanned**, on purpose. §5 is explicit: if it isn't known whether a value is
flagged as quality, it isn't extracted. A free-text scanner can't know that, so scanning qualities
would manufacture gaps out of any loose number in the row.

### `UNKNOWN_VALUE` — an out-of-catalog value that also doesn't fit a known pattern

§5 says a quality that's flagged as such but outside the list is extracted as-is. That rule is
written with `GR B7` and `GR 2H` in mind. A `45H`, or garbage, **also passes** through that door and
gets resolved. Now it's distinguished: what fits a known grade gets resolved; what doesn't is a
gap.

### And it catches something it wasn't designed for · 2026-08-22

The detector doesn't ask *"did the model get it right?"* It asks *"is there anything left over from
the row that the output doesn't explain?"* That framing turns out to cover a failure that wasn't
part of the design: **the model's non-determinism**.

While measuring the split with repetitions (`npm run split:repeat`, see `11-benchmarks.md` §5-bis)
it turned out that hard multi-element rows split badly **≈1 run in 4**. One of those runs collapsed
row 35 entirely into a single unclassified element. `npm run gaps` flagged it with four gaps: the
nut, the washer, and their two standards, all unplaced.

In other words: **an unstable split doesn't get delivered silently.** It comes out as a row that
owes an explanation, deterministically and at zero cost, without anyone having had to anticipate
this class of failure. It's the best evidence that the question is well posed — a mechanism that
only covered the cases its author imagined wouldn't have caught this.

With one nuance that needs fixing: `UNPLACED_EVIDENCE` is doing **two** jobs, and the two
recipients from §2 are different.

| What it detects | Whose job it is | Action |
|---|---|---|
| A case no policy covers (`45H`) | decision backlog | **decide** a rule |
| An element the model dropped (row 35) | the pipeline itself | **retry** the extraction |

Mixing them fills the decision backlog with things that aren't decisions: the same failure as
noise in the buyer's queue, one floor up. Separating them is pending and cheap — the deterministic
inventory already knows whether the missing name is a catalog one (incomplete split) or the value
doesn't fit any table (a real gap).

### What validates the mechanism

On its **first run** it found a real bug in the standards parser, not a hypothetical case: in
`...2 tuercas DIN 934 y 2 arandelas DIN 125...` the Spanish conjunction *"y"* was being swallowed
as a standard suffix, producing `DIN 934 Y`. The optional suffix existed for the two suffixed
entries in §8 (`DIN 125 A`, `DIN 7981 C-H`) and accepted any letter.

No one had seen it in 86 tests or across 8 evaluated models, because the mis-parsed standard still
looked like a standard. The gap caught it: **it stopped matching anything carried by a line.**

And the fix illustrates the principle: instead of listing conjunctions language by language, **the
table arbitrates** — a suffix is kept only if the suffixed designation exists in it.

## 4. What's missing for this to be a system and not a list

Detecting is half of it. The rest is designed and not built, and is stated as such.

**The vocabulary as data, not as code.** Today the tables are TypeScript and the policies are an
object with flags. A versioned `vocabulary.json`, with `who / when / why` per entry, turns
"changing a rule" into an auditable data change instead of a deployment. The client can read it; a
`.ts` file, no.

**Fail closed.** A gap should **block** resolution by default, not tag along with it. Today gaps
are reported alongside a line that's already been resolved by default. That's halfway there: the
gap is visible, but the line has already gone out. The "being 100% sure" the client asks for is
only structural if the gap blocks.

**The learning loop.** Every buyer correction in the front end is a candidate entry for the
vocabulary. That log already exists in the front-end design; what's missing is closing the loop:
correction → proposed entry → decision → rule. With that, the client has the first gold set of
their history within three weeks, which today doesn't exist anywhere in the company.

**The gap rate as a product metric.** It's the figure that makes the promise falsifiable. The first
MTO from a new firm has a high gap rate; it decays as decisions pile up. That can be measured, and
the client can be told *"the system is learning your vocabulary, and here's the curve"* instead of
just being promised it.

**Two more detectors, designed:** combinations never seen (a washer with a hex-bolt standard) and
row shapes never seen (more than N elements, two primaries, an element with no name).

## 5. The honest limit

This **doesn't** make the system get the first MTO from a new firm right.

What it does is make it fail **out loud** instead of silently, and make the cost of a mistake **a
review instead of a purchase**. It turns the unknown-unknown into a bounded, visible, and
decreasing cost.

That's the difference between a demo and something deployable, and it's the answer to what Jeremie
was asking: not a more complete rule set, but the mechanism by which the missing rules get
discovered, decided, and applied the same way next time.

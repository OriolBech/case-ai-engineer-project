# The system behind the rules

> Born from Jeremie's answer on 2026-08-22:
>
> *"I imagine the key is thinking about how to get the missing rules right, to make sure this
> insurance holds correctly at scale. At the same time, no MTO is ever the same, they're always
> different, so it helps to think about the system behind the rules, not just the rules."*

## 1. The problem, stated plainly

Policies P-1…P-11 are **rules**. And every one of them has a default, and **a default fires
silently**.

Faced with a case no policy covers, the pipeline picks the default and **resolves the line**. On
the MTO we were given, that works, because the policies were written against it. On the next MTO
from a different engineering firm — and the client says no two are alike — it's an expensive
error delivered with a machine's confidence.

The failure isn't that rules are missing. It's that **the system doesn't know when they're
missing**.

A bigger rule set doesn't fix this: it only moves the boundary of the silence. What's needed is
for the system to distinguish three situations where today it only sees two:

| Situation | Today | Should |
|---|---|---|
| Known, decided case | resolves, with provenance | same |
| Known, undecided case | goes to review, with a typed reason | same |
| **Never-seen case** | **resolves by default, silently** | **policy gap: decision pending** |

## 2. A gap is not a data problem

That's where the main design decision comes from: **a gap does not go into the buyer's queue.**

A review tells the buyer *"look at this data point."* A gap says *"this project owes someone a
decision."* They have different recipients, different cadences, and different actions, and
mixing them turns the buyer's queue into the dumping ground for both — which is exactly how it
fills up with noise, the failure the brief calls invisible.

Three channels, not two:

```
RESUELTA line ──────────────────────► RFQ
review line · MISSING_IN_SOURCE ─────► engineering   (data missing at source)
review line · LOW_CONFIDENCE ────────► buyer         (data is there, not sure)
policy gap ───────────────────────────► decision backlog   ← the new channel
```

## 3. What's detected today, and why it's deterministic

Implemented in `src/pipeline/coverage.ts`. **Zero cost, and it runs on every row**, not on a
sample, because it uses the same closed tables that produce the LLM-free baseline.

### `UNPLACED_EVIDENCE` — the row says something the output doesn't explain

The row's deterministic inventory (names, standards, finishes) is compared against what the
produced lines carry. If the row mentions a standard and **no line carries it**, or an element
is missing, or the standard was attributed to the wrong attribute.

**This catches the class of failure the span verifier can't see by construction.** When
`gpt-5.4-mini` put `ASTM F436` — a standard — into the washer's *quality* field, the span check
approved it, because the text really is in the row. Here it fails: the standard that should have
carried it was left unplaced.

**Qualities are deliberately not scanned.** §5 is explicit: if it's unknown whether a value is
marked as a quality, it isn't extracted. A scanner over free text can't know that, so scanning
for qualities would manufacture gaps out of any loose number in the row.

### `UNKNOWN_VALUE` — an out-of-catalog value that also doesn't fit a known pattern

§5 says a quality marked as such but outside the list is extracted as-is. That rule was written
with `GR B7` and `GR 2H` in mind. A `45H`, or garbage, **also passes** through that door and gets
resolved. Now the two are distinguished: whatever fits a known grade gets resolved; whatever
doesn't is a gap.

**And the finish, which was the only closed catalog that failed silently · 2026-08-23**

Of the four attributes with a closed table, three had an output path for an unknown value and one
didn't:

| Attribute | Value the table doesn't recognize |
|---|---|
| Quality | kept as `extracted_uncatalogued` **and** flagged here |
| Material | empty cell **and** flagged (`UNCOVERED_DERIVATION`, with a candidate entry) |
| Standard | preserved as-is, extracted |
| Finish | **none of the above** |

The finish had neither of the two outlets, and the combination was the worst possible case: §9
declares that the **absence** of a finish is a valid value that sends nothing to review, and
`normalize.ts` marks an unrecognized finish as `absent`. In other words, a new finish was
**indistinguishable from a finish the row simply doesn't mention**: the line came out RESUELTA
(resolved), with a word sitting in the row that nobody had read. And §9 says an element with a
finish and the same element without a finish are **different** references — the failure mode was
buying the wrong reference with not a single warning anywhere.

Two boundaries this gap does **not** cross, and both of them cost a false positive before they
existed:

- **Recognition, not attribution.** P-1 in `review` mode deliberately leaves the finish's `raw`
  value with `normalized: null` to say *"it's in the row but I'm not attributing it to this
  element."* The first version read that as "the table doesn't know it" and dumped `zincado`,
  `zinc plated`, and `ZN` from the reference MTO into the backlog as three decisions nobody owes.
  You ask the table, not the `rule`.
- **A variant is not a new value.** `GEOMET-500B` matches `GEOMET` on a word boundary and reads as
  the catalog finish. Without that boundary, the backlog would fill up with commercial suffixes
  of the seven finishes and stop pointing at what's genuinely missing.

Measured on a reference MTO with one hand-added row (`tropicalizado`): 1 gap in the new file,
**0 in the original**.

One product nuance remains, not a detection one: **seeing the gap and being able to close it.**
Material and finish are already data (SQLite + git log) and are edited at `/vocabulario`
(SPEC-011, SPEC-012). P-12 sends an unknown finish to review. Name, quality, and standard are
listed there and still aren't editable. See §4.

### And it catches something it wasn't designed for · 2026-08-22

The detector doesn't ask *"did the model get it right?"* It asks *"is there anything left in the
row that the output doesn't explain?"* That framing turns out to cover a failure that wasn't part
of the design: **the model's non-determinism**.

When split was measured with repeated runs (`pnpm run split:repeat`, see `11-benchmarks.md`
§5-bis), it turned out that difficult multi-element rows split badly **≈1 run out of every 4**.
One of those runs collapsed row 35 entirely into a single unclassified element. `pnpm run gaps`
flagged it with four gaps: the nut, the washer, and their two standards, all unplaced.

In other words: **an unstable split is not delivered silently.** It comes out as a row that owes
an explanation, deterministically and at zero cost, without anyone having had to anticipate this
class of failure. It's the best evidence that the question is well posed — a mechanism that only
covered the cases its author imagined wouldn't have caught this.

With one nuance that needs fixing: `UNPLACED_EVIDENCE` is doing **two** jobs, and the two
recipients from §2 are different.

| What it detects | Whose job it is | Action |
|---|---|---|
| A case no policy covers (`45H`) | decision backlog | **decide** a rule |
| An element the model dropped (row 35) | the pipeline itself | **retry** the extraction |

Mixing them fills the decision backlog with things that aren't decisions: the same failure as
noise in the buyer's queue, one floor up. Separating them is pending and cheap — the
deterministic inventory already knows whether a missing name is a catalog one (incomplete split)
or whether the value doesn't fit any table at all (a genuine gap).

### What validates the mechanism

On its **first run** it found a real parser bug in the standards parser, not a hypothetical case:
in `...2 tuercas DIN 934 y 2 arandelas DIN 125...`, the Spanish conjunction *"y"* ("and") was
being swallowed as a standard suffix, producing `DIN 934 Y`. The optional suffix existed for the
two suffixed entries in §8 (`DIN 125 A`, `DIN 7981 C-H`) and accepted any letter.

Nobody had caught it across 86 tests or 8 evaluated models, because the mis-parsed standard still
looked like a standard. The gap caught it: **it stopped matching anything carried by any line.**

And the fix illustrates the principle: instead of listing conjunctions language by language,
**the table arbitrates** — a suffix is only kept if the suffixed designation actually exists in
it.

## 4. What's missing for this to be a system, not a list

Detecting is half of it. The rest is designed and not built, and is stated as such.

**Rules as data, not as code.** Name, quality, and standard are still in TypeScript (the client's
catalog, read-only in the UI). Material and finish are already SQLite + git log, editable from
`/vocabulario`. Policy flags really do switch from the environment (2026-08-22). Vocabulary and
policy remain distinct objects: the former decides **values** and is approved with an ambiguity
guard; the latter decides **behavior** and is approved with **the KPI delta**. Still missing is
the console that shows that delta before signing off, and per-issuer scoping. Taxonomy in
`03-policies.md`.

**Fail closed.** P-12 already blocks an unknown finish. The rest of the gaps are reported
alongside a line that may have come out via a default. The client's "100% safe" is only
structural if **every** gap blocks, not just this one.

**The learning loop.** The buyer can already onboard aliases and derivations from the front end.
Suggestions are applied within the session and have their own KPI (SPEC-013); they aren't yet
persisted from the UI. What's missing for a continuous gold set is wiring it to the history and
treating discrepancies between buyers as vocabulary decisions, not model bugs.

**The issuer, stamped onto the gap.** Today a `PolicyGap` (`src/pipeline/coverage.ts`) doesn't say
which row it came from, so the decision backlog is **global**. As a result, the same gap seen at
two different firms collapses into a single decision, and the system can't tell apart two things
that have nothing in common:

| What's seen | What it is | Action |
|---|---|---|
| A gap that repeats | **A rule is missing** | decide it, and it applies to everyone |
| A gap that repeats **only at one issuer** | **That's how that issuer writes it** | a convention, not a rule |

It's the same confusion as in §3 — `UNPLACED_EVIDENCE` doing two jobs — one floor up: the decision
backlog fills up with things that aren't decisions, just ways of writing.

And it separates two costs that the deferral in `03-policies.md` §"Scope" lumps together.
**Observing** the convention is just one more field on top of the provenance that already exists,
and it **doesn't split** the KPI: it decomposes it, the global figure remains the aggregate.
**Acting** on it — policies scoped per issuer — does carry the cost written there. Only the
second is deferred. And when it's time, the warning is already built: it's the same override
mechanism that shouts *"these figures are NOT comparable with the published ones,"* with one more
dimension.

**The gap rate as a product metric.** This is the figure that makes the promise falsifiable. The
first MTO from a new firm has a high gap rate; it decays as decisions accumulate. That can be
measured, and it lets you tell the client *"the system is learning your vocabulary, and here's
the curve"* instead of just promising it.

With the nuance above: **the curve is per issuer or it's nothing.** A global rate averages
populations the client itself says are different — *"no two MTOs are alike"* — and an average
over different populations doesn't decay from learning, it decays from mixing. That's the half
of Jeremie's sentence the rest of this document doesn't answer.

**Two more detectors, designed:** never-seen combinations (a washer with a hex-bolt standard) and
never-seen row shapes (more than N elements, two primaries, an element with no name).

## 5. The honest limit

This does **not** make the system get the first MTO from a new firm right.

What it does is make it fail **out loud** instead of silently, and make the cost of being wrong
**a review instead of a purchase**. It turns the unknown-unknown into a cost that is bounded,
visible, and decreasing.

That's the difference between a demo and something deployable, and it's the answer to what
Jeremie was asking: not a more complete rule set, but the mechanism by which the rules that are
missing get discovered, decided, and applied the same way next time.

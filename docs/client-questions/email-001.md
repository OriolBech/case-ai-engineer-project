# Questions for the client · Email 001

Copy from `---` to `---`. Metadata and follow-up at the end of the file.

---

**To:** Adolfo, Guillermo, Jeremie
**Subject:** AI Engineer technical case · Fasteners · 2 questions (holding the third in reserve)

Hi Adolfo, Guillermo, Jeremie,

I've finished reading the brief and `reglas_tornilleria.md`. Before writing any code I hand-labeled
the 15 rows to have a reference to measure against: 15 rows produce **30 output lines**, and with
the rules exactly as written, the resolution ceiling is 15 of 30. The rest is quality the MTO
doesn't write for the nuts and washers in a set: that goes back to engineering, and no model fixes
it.

On that basis I went through section 10 point by point. The criterion for spending a question
wasn't how many lines each point moves **in these 15 rows** —you're taking it as a given that the
session's set will be different and will have traps, so optimizing against the sample doesn't
help— but two things that hold for any MTO: **whether the point's volume depends on this
particular file or on how MTOs are generally written**, and **whether getting it wrong produces a
line sent to review or a resolved line with the wrong data**. Only two of the six points are
invariant and fail on the costly side.

I'm deliberately using **two** of the three questions. I'm holding the third in reserve for the
implementation phase: I'd rather spend it on something that actually surfaces once the code is in
front of me than on something I believe I can close on my own today.

**1. Material derived from quality** (section 10, point 1).

Does it work for you if the system derives `AC`/`INOX` from the quality (`A4-70`→`INOX`,
`8.8`→`AC`), flagged as derived and with a trace to the value that justifies it? Or should a line
with no material written go to review?

I'm asking because this isn't a gap in this particular file, it's structural: the column named
`MATERIAL` is occupied by the quality (`8.8`, `A4-70`) or by the standard with its grade (`ASTM
A193 GR B7`), so the material isn't written anywhere in the row **at all**. Your own rules say so
in general —*"la regla dice extraerlo del MTO, y el MTO casi nunca lo escribe"*— and that affects
nearly 100% of the lines in any MTO you hand me, not 93% of these 15.

And I can't work out the answer no matter how much data I look at, because it isn't in the data:
it depends on whether your material master accepts that derived field to register the reference
and issue the RFQ. If I derive it and it doesn't accept it, I've put an unaudited value into
procurement. If I don't derive it and it did accept it, the system resolves practically nothing.

*Default if there's no answer: it's derived from the quality, flagged as derived and never as an
extracted value, and it doesn't block resolution.*

**2. Scope of the finish within a set** (section 10, point 4).

When the finish is written just once at the end of a row that describes an entire set (`BOLT
DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated`): does it apply to every
element in the set, or only to the main one?

I'm asking for three reasons, and the third is the one that decided it for me.

First: it's the only point where both outputs seem bad to me. Extrapolating it contradicts your
rule that only the measure gets extrapolated; not extrapolating it produces a physically
inconsistent set —a galvanized bolt with a bare nut— which, under your no-mixed-finishes rule, is
also a different material altogether.

Second: the volume doesn't depend on the sample. Writing the finish once at the end of the row is
the normal way of writing an MTO —4 of the 9 sets in these 15 rows do it— and that isn't going to
change in the session's set.

Third: **getting this wrong doesn't send the line to review, it resolves it incorrectly**. Under
your no-mixing rule, a galvanized nut and an unfinished nut are two different references, so the
error comes out as `RESUELTA` with the wrong material — which is the 3–8 week error the brief
talks about, not the one that only costs a review.

And there's a detail that means I can't calibrate this against your sample: in these 15 rows the
decision doesn't change **a single** line, because the affected secondary elements also lack a
quality and go to review anyway. That zero is the problem. As soon as an MTO writes the secondary
element's quality, that line becomes resolvable, and then the finish decides what gets purchased.
**The point matters more the better-written the MTO is**: its impact grows exactly where the
system works, and it's invisible both in the sample you gave me and in the demo.

*Default if there's no answer: the finish written at the row level applies to every element in the
set, flagged as extrapolated, with the decision toggleable via a flag.*

**The four points I'm not asking about, and why.**

- **Length without a unit** (point 3). `7/8" X 130`, `M20x90`. The metric case isn't ambiguous:
  `M20x90` is the ISO designation and it's 90 mm. The imperial case is, and there I apply a
  physical-plausibility range —130 inches is 3.3 meters, absurd for a 7/8" stud. It doesn't spend
  a question because I have a verifiable criterion and because **it fails with a safety net**:
  whatever falls outside the range isn't resolved incorrectly, it goes to review with reason
  `LENGTH_UNIT_IMPLAUSIBLE`. I lose autonomy, I don't buy the wrong thing. It's my first candidate
  for the third question if, once implemented, I find your files never write the unit and the
  range falls short.
- **Missing standard** (point 2). Without a standard there's no reference to request from a
  supplier, and your section 3 says that what tells two catalog bolts apart is precisely the
  standard. I send it to review, aware that **I'm adding a review rule your rules don't have**
  —section 5 says the quality one is the only one. In practice it overlaps: the secondary element
  described generically (`con tuerca y arandela`) also lacks a quality, so it was already going to
  review.
- **Quantities** (point 5). It isn't one of the seven attributes, so it doesn't block resolution.
  I use the written multiplicity when it's there (`W/2 HEX. NUT`) and when it isn't I don't invent
  one: 1, flagged as inferred and confirmable in bulk from the front end.
- **Coherence checks** (point 6). A nut with quality `8.8` goes to review, because your own
  definition includes "or there's an incoherence." And I will never turn `8.8` into `8` on a nut
  even if it fits: they're distinct equivalence groups, and silently changing the specification is
  exactly the costly error.

Both questions are closed-ended with the default stated, so answering costs 30 seconds and neither
blocks me. If there's no answer I'll start with the defaults, and in the session I'll show you the
delta of each alternative by flipping a flag live.

Thanks,
Oriol

---

## Follow-up

| | |
|---|---|
| **Slots used** | 2 of 3 · **1 held in reserve** for the implementation phase |
| **Sent** | ⬜ pending |
| **Answered** | ⬜ pending |

### Selection criterion

Not the Δ in resolved lines over the 15 given rows: that sample isn't the population, and the
blind set is 12 new rows with traps. Two axes that hold for any MTO:

| §10 point | Volume | Failure mode | Slot? |
|---|---|---|---|
| 1 · Material | **invariant** (the `MATERIAL` column doesn't carry material, by design) | total autonomy | ✅ Q1 |
| 4 · Finish in a set | **invariant and anti-correlated** (grows with how well-written the MTO is) | **silent false-resolved** | ✅ Q2 |
| 3 · Length without a unit | sample-dependent (artifact of the `MEDIDA` column's format) | autonomy, with a safety net | ❌ reserve 1st |
| 2 · Missing standard | masked by the quality rule | autonomy | ❌ |
| 5 · Quantities | invariant, but outside the 7 attributes | quantity purchased | ❌ |
| 6 · Coherence checks | — | already resolved by the brief | ❌ |

**Candidates for the reserved slot**, in order: (1) length without a unit, if their files' format
never writes the unit; (2) **P-9, row outside the family** — it isn't in §10, and in a real 20,000-row
MTO with 15–25% fasteners it's the biggest sink of precision in the whole problem.

| # | §10 point | Policy | Status |
|---|---|---|---|
| 1 · Derived material | §10.1 | [P-3](../03-policies.md#p-3--material-not-written) | default applied |
| 2 · Finish in a set | §10.4 | [P-1](../03-policies.md#p-1--scope-of-the-finish-within-a-set) | default applied |

**Once an answer arrives**: log it in [`answers.md`](answers.md), mark the policy as
*confirmed* in [`03-policies.md`](../03-policies.md), and **leave the flag in place** so the
alternative and its KPI delta can still be demonstrated in the challenge.

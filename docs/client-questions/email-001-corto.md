# Questions for the client · Email 001 · version to send

Recipient: Jeremie. Same two questions and same defaults as
[`email-001.md`](email-001.md), in email tone. The long version stays as a record of the
reasoning for the 2-pager and the session.

---

**To:** Jeremie
**Subject:** AI Engineer case · fasteners · 2 questions

Hi Jeremie,

I've read the brief and the rules, and before starting to build I went point by point through
section 10. To decide what to ask, I didn't look at how many lines each point moves across the 15
rows, because the session's set is going to be a different one. I looked at two other things:
whether the gap belongs to this particular file or to how MTOs are generally written, and whether
getting it wrong leaves the line in review or leaves it resolved with the wrong data. Of the six
points, only two meet both.

Both come with the default I'll apply if you don't tell me otherwise, so neither blocks me. And
I'm using two questions, not three: I'm holding one back for when I'm implementing, which is
usually when things I don't see today come up.

**1. Material derived from quality (point 1)**

Does it work for you if I derive AC/INOX from the quality (A4-70 → INOX, 8.8 → AC), flagging it as
derived and keeping a trace of the value it came from? Or does a line with no material written
have to go to review?

The MATERIAL column carries quality or standard, never a material, so the data isn't anywhere in
the row. It isn't a gap in these 15 rows specifically: it's going to happen on almost every line of
any MTO you hand me. And the answer isn't in the data, it's in your material master. If it doesn't
accept a derived field to register the reference and issue the RFQ, deriving it doesn't do me any
good.

Default: I derive it, flagged as derived and never as an extracted value, and it doesn't block
resolution.

**2. How far the finish reaches in a set (point 4)**

When the finish appears just once at the end of a row describing an entire set ("...with NUT
DIN934 and WASHER DIN125, 8.8, zinc plated"), does it apply to every element or only to the main
one?

Both options seem bad to me. If I extrapolate it, I contradict the rule that only the measure gets
extrapolated. If I don't, I end up with a galvanized bolt and a bare nut, which is also a different
material under the no-mixing rule. And here, getting it wrong doesn't cost a review: the line comes
out resolved with the wrong reference.

The odd thing is that in these 15 rows this decision doesn't change a single line, because those
secondary elements also lack a quality and already go to review for that reason. But as soon as an
MTO carries the nut's quality, the line becomes resolvable, and then the finish decides what gets
bought. I can't calibrate this against your sample, and you won't see it fail in the demo either.

Default: it applies to the whole set, flagged as extrapolated and toggleable.

**The other four, I'm closing myself**

The one that gave me the most trouble to leave out is length without a unit (point 3). In metric
there's no doubt: M20x90 is the ISO designation and it's 90 mm. In imperial there is, "7/8" X 130",
the 130 is loose. Instead of deciding it row by row, I built a table of plausibility ranges per
measure and apply it to all of them at once: 130 inches is 3.3 meters, which doesn't exist for a
7/8" stud, so it's mm. And whatever falls outside the range isn't resolved incorrectly, it drops
to review with reason LENGTH_UNIT_IMPLAUSIBLE. I lose autonomy, I don't buy the wrong thing. It's
my first candidate for the third question if, once implemented, I find your files never write the
unit and the table falls short.

The other three, more quickly. Missing standard: to review, because your section 3 says what tells
two catalog bolts apart is the standard, and without a standard there's nothing specific to
request from a supplier. Quantities: not one of the seven attributes, I use the multiplicity when
it's written (W/2 HEX. NUT) and don't invent what's missing. The nut with quality 8.8: an
incoherence, to review, and I don't convert it to 8 even though it would fit, because they're
distinct equivalence groups and changing the specification on my own is the error that gets
expensive.

If I don't hear back I'll start with the defaults, and in the session I'll show you what happens
with each alternative by flipping a flag.

Thanks,
Oriol

---

## Follow-up

| | |
|---|---|
| **Recipient** | Jeremie |
| **Slots used** | 2 of 3 · 1 held in reserve for implementation |
| **Sent** | ⬜ pending |
| **Answered** | ⬜ pending |

| # | §10 point | Policy |
|---|---|---|
| 1 · Derived material | §10.1 | [P-3](../03-policies.md#p-3--material-no-escrito) |
| 2 · Finish in a set | §10.4 | [P-1](../03-policies.md#p-1--alcance-del-acabado-dentro-de-un-set) |

**Reserve**, in order: length without a unit if their files never write the unit; P-9 row outside
the family (it isn't in §10, and in a 20,000-row MTO with 15–25% fasteners it's the biggest sink of
precision in the problem).

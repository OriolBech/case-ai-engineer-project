# Questions for the client · Email 001

Copy from `---` to `---`. Metadata and follow-up at the end of the file.

---

**To:** Adolfo, Guillermo, Jeremie
**Subject:** AI Engineer technical case · Fasteners · 3 questions

Hi Adolfo, Guillermo, Jeremie,

I've finished reading the brief and `reglas_tornilleria.md`, and before I start building I'm using
the three questions.

All three are from section 10. I deliberately left out the points I think I can close with a
defensible judgment call of my own —length with no unit, a line with no standard, the nut with
quality `8.8`— and I picked the three where getting it wrong on my own seems costly: either both
possible options are bad, or the right one depends on something only you know.

To make answering cheap, each one is closed-ended and comes with the default I'll apply if you
don't tell me otherwise. They don't block me.

**1. Scope of the finish within a set.**

When the finish is written once at the row level for a whole set (`Tornillo
DIN 933 M16x60 con tuerca DIN 934 y arandela DIN 125, 8.8, zincado`): does it apply to every
element of the set, or only to the main one?

I'm asking because it's the only point where both outputs seem bad to me: extrapolating it
contradicts the rule that only measurement gets extrapolated, and not extrapolating it produces a
mixed set —a zinc-plated bolt with an unfinished nut— which, by the no-mixing rule, is also then a
different material.

*Default if there's no reply: it applies to the whole set, flagged as inferred and with the
decision made switchable.*

**2. Multiplicity when it isn't written.**

`W/2 HEX. NUT` is explicit, but `with NUT` and `con tuerca y arandela` are not. Do you currently
apply any procurement convention to derive that quantity, or is an unwritten quantity treated as
missing data that goes back to engineering?

I'm asking because quantity isn't one of the seven attributes, but without it the line can't be
purchased, so I don't know whether a line with all seven attributes resolved and the quantity
inferred should come out as `RESUELTA` or as `REVISION_MANUAL`. That changes what my KPI measures,
not just what the system does.

*Default if there's no reply: multiplicity 1 unless another is written, 2 nuts per stud bolt going
by what rows 1 and 5 show, always flagged as inferred and confirmable in bulk from the front end.*

**3. Material derived from quality.**

The MTO almost never writes the material, and the `MATERIAL` column contains quality or standard.
Does it work for you that `AC`/`INOX` be derived from the quality (`A4-70`→`INOX`, `8.8`→`AC`),
flagged as inferred, or should a line with no explicit material go to review?

I'm asking because it's the highest-volume point —14 of the 15 rows carry no material— and the
right answer depends on whether your materials master needs that field to register the item and
launch the RFQ. If I send it to review for missing material, the system resolves almost nothing;
if I derive it and your master doesn't accept an inferred value, I've put a value into procurement
that no one has audited.

*Default if there's no reply: derive it from the quality with traceability to the value that
justifies it, never as an extracted value, and it doesn't block resolution.*

Thanks,
Oriol

---

## Follow-up

| | |
|---|---|
| **Slots used** | 3 of 3 (case maximum) |
| **Sent** | ⬜ pending |
| **Answered** | ⬜ pending |

| # | Policy it decides | Volume affected | Status |
|---|---|---|---|
| 1 · Finish in sets | [P-1](../03-policies.md#p-1--alcance-del-acabado-dentro-de-un-set) | 4/15 rows | default applied |
| 2 · Multiplicity | [P-2](../03-policies.md#p-2--multiplicidad-no-escrita) | 3–4/15 rows | default applied |
| 3 · Derived material | [P-3](../03-policies.md#p-3--material-no-escrito) | 14/15 rows | default applied |

**Selection criteria and the 5 discarded questions**: [ADR-002](../decisions/ADR-002-three-questions.md).

**On receiving a reply**: note it in [`respuestas.md`](respuestas.md), mark the policy as
*confirmed* in [`03-policies.md`](../03-policies.md), and **leave the flag in place** so the
alternative and its KPI delta can be demonstrated in the challenge.

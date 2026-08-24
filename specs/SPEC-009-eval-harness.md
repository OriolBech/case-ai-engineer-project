# What I've decided not to do

> Status: ✅. Feeds section 5 of the 2-pager. *"A case without this section is a case where nothing
> was decided."* Each entry: what, why not, what it would have cost, and what it would have bought.

| What | Why not | Cost avoided | What it would have bought |
|---|---|---|---|
| Fine-tuning or massive few-shot on the 15 rows | Judgment is tested against a blind set of 12 new rows: tuning against the given data is explicitly useless | ~2 h | Nothing, or an inflated KPI |
| LLM in normalization | These are 4 closed, exhaustive tables. It's exactly the judgment error the case penalizes | — | Nothing, and it costs money on top |
| Other families besides fasteners | The scope is deliberately small: they want depth | — | Surface area |
| Deployment / Docker / CI | The brief explicitly says deployment isn't needed | ~1 h | Nothing evaluable |
| Authentication and multi-user in the front end | The demo's user is a single buyer | ~1.5 h | Nothing evaluable |

## The ones that were hard to decide · added while measuring

The ones above were decided on day 0 and none of them hurt. These were decided with a measurement
in hand, and they're the ones that teach something.

### Removing the critic

**It came close to being cut.** The written stopping criterion was: tighten the prompt → if
precision doesn't get above 70%, switch models → if that doesn't work either, remove it. With 29%
recall and 33% precision, and **31.8% queue noise**, the decision seemed made.

**Why it stays.** The noise wasn't coming from the model: it was given the **normalized** output
and asked to refute it against the **raw** text, with no way to tell the client's own tables apart
from an error. It flagged `DIN931` → `ISO 4014` as if it were an invention. Given the provenance of
each value, precision goes from **33% to 90%**.

**And what nearly made it leave with a false claim**: every critic figure was from **a single
pass**. Three repetitions on the same input give recall of **14%, 43%, and 71%**. The documented
29% was one sample, and a 0% I measured myself that same afternoon was too. It came close to
removing a component that, on its best pass, eliminates 5 of 7 silent errors.

### Implementing the union of N critic passes

I have it measured —union of three: recall 71%, precision 83%, **$0.0045 per MTO**— and **I
haven't implemented it**. It's safe by construction, because the critic can only downgrade, so
every extra pass only adds catches.

**Why not**: the union figure is **arithmetic over three measured passes**, not a run of the
function. Adding it before delivery would mean shipping code whose number I haven't actually
measured, which is exactly the error this document already records three times. It goes as a line
in `07-target-solution.md` with its cost.

### The deterministic filter before the model

A 5× cost reduction, measured at **0 false negatives and 0 false positives on 79 rows**, not
implemented. It changes the semantics of P-9 —the out-of-family verdict would move from the model
to a table in 80% of cases— and that's a product decision with its own measurement, not a
last-minute patch. The cost of not doing it is bounded and stated: 48 € per site instead of ~10 €.

### The third question to the client

There were three slots and I used two (finish scope, implicit multiplicity) plus the material one.
The candidate was the unit for imperial lengths (P-4), and **I didn't spend it**: there's a
defensible unilateral criterion —a physical plausibility range applied outright— and what the
range doesn't separate out **doesn't get resolved wrong**, it falls to review with
`LENGTH_UNIT_IMPLAUSIBLE`. Measured impact: **3 cells out of 240**.

Asking something that's already decided, measured, and bounded spends a slot and signals a failure
to decide. The slot is kept for a real blocker.

### Repeating the 8-model sweep with the eight cells

The sweep in `11-benchmarks.md` §2 was measured over **seven** cells, before quantity was graded.
Repeating it costs ~0.12 € and I haven't done it: the conclusion it supports —price doesn't
predict quality— is decided by **split fidelity**, which doesn't depend on quantity. What I've
done is **flag the table** with what's missing from it, instead of letting it be read as if it
were on the same basis as the rest.

### A complete "no-LLM" mode

The deterministic baseline exists (`findNames`, `findStandards`, `findFinishes`) and is used for
routing, for gap detection, and for deciding the name, the designation length, and the
multiplicity. **I haven't closed it off as a complete execution mode.**

Why: without a model there's no set segmentation, and 47% of the rows in the given MTO describe
more than one material. A no-LLM mode would give 15 lines where there are 30. As an *ablation* to
demonstrate what the model buys, it's worthwhile; as a production mode, no.

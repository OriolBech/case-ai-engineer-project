# The target solution

> Status: 🚧. Feeds section 4 of the 2-pager: what I'd build with no time constraint, how it
> differs, what KPI delta it buys, and how much it costs.

Items already identified on day 0:

| # | What | What it buys | Approx. cost |
|---|---|---|---|
| 1 | **The front end as a ground-truth generator.** Every correction the buyer makes is a label. In 3 weeks the client has the first gold set in its history, which doesn't exist anywhere in the company today. | Turns the KPI from an estimate over 40 lines into a continuous measure over thousands. It's the unlock for everything else. | Low. It's a log and a view. |
| 2 | **Matching against the material master and vendor catalogs.** Normalizing isn't the end: the buyer needs the reference. Retrieval against the master + reconciliation. | Eliminates the subsequent manual step, which the brief calls "the easy part" but is still work. | Medium. Depends on the master's quality. |
| 3 | **Revision management (diff between rev 9 and rev 12).** The brief mentions this as a consequence of normalization: *"you can't see that revision 12 asks for two thousand bolts that were already purchased in revision 9."* | It's probably the biggest economic saving in the whole project, and no part of this case addresses it. | Medium-high. Requires stable material identity across revisions. |
| 4 | **A continuous evaluator in production** with sampling and drift alerting. | Protects the committed number over time, not just on demo day. | Low-medium. |
| 5 | **A common versioned vocabulary** (the "canonical material") instead of tables in a .md file. | Lets two buyers converge and lets the client audit changes in criteria. | Medium. |

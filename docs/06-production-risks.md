# What breaks this in production

> Status: 🚧. Feeds section 6 of the 2-pager. The three risks that actually worry us when
> this leaves the laptop and enters a procurement department. Not generic risks.

Candidates identified on day 0 (to be narrowed down to three by day 5):

1. **The queue fills up with noise and the buyer stops looking at it.** This is the risk the
   brief itself flags as the "invisible failure," and it isn't technical: it's about adoption. With 25 reviews it
   builds up fast. Mitigation: `queue_noise` as a first-class metric, and grouping of reviews
   by reason, so that 300 lines with the same reason get resolved in a single action.
2. **Two buyers don't normalize the same way, so there's no single truth to measure against in
   production.** The system learns from contradictory corrections. Mitigation: the correction log
   records *who* made the correction, and disagreements between buyers are escalated as a
   vocabulary decision, not as a model bug.
3. **The client's material master data is dirty**, so a perfectly
   normalized line may have no reference to match against. Normalization is not the end of the road.
4. **Silent drift**: a new engineering firm starts writing in a different style and the
   silent error rate rises without anyone noticing, because no one is measuring it. Mitigation: mandatory
   sampling of resolved lines for periodic auditing.
5. **Cost**: 4,000 rows × 25 revisions × N LLM calls. If the critic runs over everything
   instead of over the subset, the CFO does the multiplication.

# ADR-003 · LLM Provider: OpenAI, behind a provider interface

- **Date**: 2026-08-21
- **Status**: accepted (provisional until the day-4 comparison)

## Context

The brief allows any model or service: *"The data is synthetic and anonymized:
you can use it with any model or service."*

The initial doubt was about cost. The analysis in `docs/02-kpi.md` defuses it: the whole case
costs less than €15 of inference, and in production the system runs at ~€2,500/project versus
~€87,500 for the manual baseline. **At this scale, price per token doesn't decide anything.**
What does decide is accuracy in set explosion, which is the metric the brief calls "the rule
that costs the most."

Real deciding factor: there is already an operational OpenAI API key in the environment. Spending
day-1 time on a provider decision instead of on the gold set would be a poor use of the 5–10 h
budget.

## Decision

1. **OpenAI as the initial provider**, with `gpt-5.5` for the stages with real language (split and
   extract) and `gpt-5.4-mini` for iterating during development and as a candidate for the critic.
2. **The entire pipeline calls `src/lib/llm.ts`**, never the SDK directly. Switching providers
   means changing environment variables.
3. **The choice is measured, not argued.** On day 4, with the harness already built, the same
   evaluation is run against both providers and the comparison goes into the 2-pager:
   `silent_error_rate`, `split_fidelity`, €/row, and per-model latency.

Point 3 is what turns a provider doubt into an asset: the evaluation criteria ask
*"how you measure, and whether you understand your own number well enough for us to believe it."*
Arriving with the model choice justified by your own data is worth more than the choice itself.

## Discarded alternatives

| Alternative | Why not |
|---|---|
| Self-hosted open model | No local GPU. And it's not needed: inference is an HTTPS call, the model doesn't run on the laptop |
| Cloudflare Workers AI | Hosting a small model saves nothing relevant and costs accuracy right where it matters most: multilingual set segmentation, the graded part |
| Cloudflare AI Gateway | Coherent but unnecessary: the local cache (ADR-004) provides caching and determinism without deploying anything, and works without network |
| Deciding the provider by rate price | Optimizes the variable that isn't evaluated. The difference is ~€4 across the whole case |
| A small model for split/extract | The decision that matters isn't the provider, it's the tier: small models fall down on multilingual prose with literal spans, and that hits `split_fidelity` |

## Consequences

**In favor**: immediate start, zero time spent on the decision, and a measured comparison as a
free byproduct of the harness.

**Measured on 2026-08-22** with real rates and real token counts: **€0.024/row**, €69 per
MTO review, €1,726 per project, versus €87,500 for the manual baseline — **2.0%**. The
qualitative conclusion is confirmed with numbers: inference cost is not the constraint.

Unexpected finding: **96% of the cost at scale is output tokens**, so the lever isn't
input caching but output verbosity and model choice. Details in
`docs/02-kpi.md`.

**Open risk**: the model listing shows a `gpt-5.6-luna` / `-sol` / `-terra` family
whose characteristics and pricing are not verified. It is not used by default. If it becomes of
interest in the day-4 comparison, its price and structured-output support are verified first.

## How to revert

Change `LLM_PROVIDER` in `.env`. The pipeline doesn't import any SDK directly.

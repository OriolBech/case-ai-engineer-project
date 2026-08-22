# ADR-003 · LLM provider: OpenAI, behind a provider interface

- **Date**: 2026-08-21
- **Status**: accepted (provisional until the day-4 comparison)

## Context

The brief allows any model or service: *"The data is synthetic and anonymized: you can use it
with any model or service."*

The initial doubt was about cost. The analysis in `docs/02-kpi.md` defuses it: the whole case
costs less than €15 in inference, and in production the system is ~€2,500/site versus
~€87,500 for the manual baseline. **At this scale, price per token decides nothing.** What does
decide is accuracy in set explosion, which is the metric the brief calls "the rule that costs
the most."

Real deciding factor: there's already a working OpenAI API key in the environment. Spending day-1
time on a provider decision instead of on the gold set would be a poor use of the 5–10 h budget.

## Decision

1. **OpenAI as the initial provider**, with `gpt-5.5` for the stages with real language (split
   and extract) and `gpt-5.4-mini` for iterating during development and as a candidate for the
   critic.
2. **The whole pipeline calls `src/lib/llm.ts`**, never the SDK directly. Switching providers
   means changing environment variables.
3. **The choice is measured, not argued.** On day 4, with the harness already built, the same
   evaluation runs against both providers and the comparison goes into the 2-pager:
   `silent_error_rate`, `split_fidelity`, €/row, and latency per model.

Point 3 is what turns a provider doubt into an asset: the evaluation criteria ask *"how you
measure, and whether you understand your own number well enough for us to believe it."* Arriving
with the model choice justified by your own data is worth more than the choice itself.

## Alternatives discarded

| Alternative | Why not |
|---|---|
| Self-hosted open model | No local GPU. And it isn't needed: inference is an HTTPS call, the model doesn't run on the laptop |
| Cloudflare Workers AI | Hosting a small model saves nothing relevant and costs accuracy exactly in multilingual set segmentation, which is the graded part |
| Cloudflare AI Gateway | Coherent but unnecessary: the local cache (ADR-004) gives caching and determinism without deploying anything, and it works offline |
| Deciding the provider by rate card price | Optimizes the variable that isn't evaluated. The difference is ~€4 across the whole case |
| Small model for split/extract | The decision that matters isn't the provider, it's the tier: small models fall down on multilingual prose with literal spans, and that hits `split_fidelity` |

## Consequences

**For**: immediate start, zero time spent on the decision, and a comparison measured as a free
byproduct of the harness.

**Against**: the €/row estimate in `docs/02-kpi.md` was done with Anthropic rates and **is still
pending recalculation** with real OpenAI rates and the token count measured on day 2. The
qualitative conclusion —inference cost isn't the constraint— holds with either one, but the
number in the 2-pager has to be the real one.

**Open risk**: the model listing shows a `gpt-5.6-luna` / `-sol` / `-terra` family whose
characteristics and pricing aren't verified. Not used by default. If it becomes relevant in the
day-4 comparison, its price and structured-output support get verified first.

## How to revert

Change `LLM_PROVIDER` in `.env`. The pipeline doesn't import any SDK directly.

# ADR-003 · LLM provider: OpenAI, behind a provider interface

- **Date**: 2026-08-21
- **Status**: accepted (provisional pending the day-4 comparison)

## Context

The brief allows any model or service: *"Los datos son sintéticos y anonimizados: puedes usarlos
con cualquier modelo o servicio."*

The initial doubt was about cost. The analysis in `docs/02-kpi.md` defuses it: the full case
costs less than €15 in inference, and in production the system runs ~€2,500/site versus
~€87,500 for the manual baseline. **At this scale, per-token pricing decides nothing.** What
does decide it is accuracy in set explosion, which is the metric the brief calls "the costliest
rule."

The real deciding factor: a working OpenAI API key already exists in the environment. Spending
day-1 time on a provider decision instead of on the gold set would be a poor use of the 5–10 h
budget.

## Decision

1. **OpenAI as the initial provider**, with `gpt-5.5` for the stages involving real language
   (split and extract) and `gpt-5.4-mini` for iterating during development and as a critic
   candidate.
2. **The entire pipeline calls `src/lib/llm.ts`**, never the SDK directly. Switching providers is
   a matter of changing environment variables.
3. **The choice is measured, not argued.** On day 4, once the harness is built, the same
   evaluation is run against both providers and the comparison goes into the 2-pager:
   `silent_error_rate`, `split_fidelity`, €/row, and latency per model.

Point 3 is what turns a provider question into an asset: the evaluation criteria ask *"cómo
mides, y si entiendes tu propio número lo suficiente para que nos lo creamos"*. Arriving with the
model choice backed by your own data is worth more than the choice itself.

## Alternatives discarded

| Alternative | Why not |
|---|---|
| Self-hosted open model | No local GPU. And it isn't needed: inference is an HTTPS call, the model doesn't run on the laptop |
| Cloudflare Workers AI | Hosting a small model saves nothing relevant and costs accuracy exactly on multilingual set segmentation, which is the graded part |
| Cloudflare AI Gateway | Coherent but unnecessary: the local cache (ADR-004) provides caching and determinism without deploying anything, and works offline |
| Deciding the provider by rate | Optimizes the variable that isn't evaluated. The difference is ~€4 across the whole case |
| Small model for split/extract | The decision that matters isn't the provider, it's the tier: small models fall apart on multilingual prose with literal spans, and that hits `split_fidelity` |

## Consequences

**In favor**: immediate start, zero time spent on the decision, and a measured comparison as a
free byproduct of the harness.

**Measured on 2026-08-22** with real rates and real token counts: **€0.024/row**, €69 per MTO
review, €1,726 per site, versus €87,500 for the manual baseline — **2.0%**. The qualitative
conclusion is confirmed with numbers: inference cost isn't the constraint.

> **Correction, 2026-08-24** (the above isn't rewritten: it was `gpt-5.5`, denominator 100,000,
> with caching). The system bills per **read** row: 500,000 reads/site. The model actually
> shipped is `gpt-oss-120b` at **€0.000095/row → €48/site**. `gpt-5.5` with the same denominator
> is **€8,750/site**. Detail in `docs/05-results.md` §7 and `docs/02-kpi.md`.

Unanticipated finding: **96% of the cost at scale is output tokens**, so the lever isn't input
caching but output verbosity and model choice. Detail in `docs/02-kpi.md`.

**Open risk**: the model listing shows a `gpt-5.6-luna` / `-sol` / `-terra` family whose
characteristics and pricing aren't verified. It isn't used by default. If it becomes relevant in
the day-4 comparison, its price and structured-output support will be verified first.

## How to revert

Change `LLM_PROVIDER` in `.env`. The pipeline doesn't import any SDK directly.

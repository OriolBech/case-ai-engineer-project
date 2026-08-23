# ADR-005 · Declarative model tiers and OpenRouter as an open alternative

- **Date**: 2026-08-22
- **Status**: accepted
- **Partially supersedes**: ADR-003 (which fixed a single provider with models in loose
  variables)

## Context

Three things were pushing at once:

1. Measurement showed that **96% of cost at scale is output tokens**. The lever isn't the input
   cache: it's the model's output price.
2. `gpt-5.4-mini` gave a **50% silent error** rate and `gpt-5.4` gave 6.7%, while `gpt-5.5` gave
   0%. Downgrading models isn't free, and it needs to be changeable per stage instead of
   project-wide.
3. The earlier configuration had the model in one variable and its rates in three others. That's
   exactly how a €/row figure quietly goes false: someone changes the model and the rate is left
   behind.

## Decision

**One tier = one configuration line**, with the rates attached to the model:

```
LLM_MAIN=openai:gpt-5.5:5.00:30.00:0.50
LLM_CHEAP=openai:gpt-5.4:2.50:15.00:0.25
LLM_CRITIC=openrouter:openai/gpt-oss-120b:0.03:0.17
```

Three tiers with a defined role:

| Tier | For what | Criterion |
|---|---|---|
| `main` | Multi-element rows | Attribution risk exists there |
| `cheap` | Single-element rows | Nowhere to go wrong |
| `critic` | The safety net | Can only degrade → a weak model is safe here |

**OpenRouter as a second provider**, with the same `LlmProvider` interface. Nothing in
`src/pipeline` imports a provider SDK: switching from one to the other per stage is a single
`.env` line.

## Why the critic is the natural place for the open model

Because its invariant bounds the damage. It can only degrade, so disagreeing for no reason adds
one line to the review queue (the cheap error), and agreeing when it shouldn't leaves the line as
it was (no protection gained, nothing lost). A component whose worst case is "no better than not
having it" doesn't need the expensive model.

## The open-model numbers

With measured tokens (1,730 input / 652 output per row):

| Configuration | €/row | € per site (4,000 rows × 25 reviews) |
|---|---|---|
| `gpt-5.5` | 0.0175 | **1,749** |
| `gpt-5.4` | 0.0087 | 874 |
| `openai/gpt-oss-120b` (open) | 0.000095 | **9** |
| Manual baseline | 0.875 | 87,500 |

**This doesn't make the open model the right choice.** It makes the decision purely a matter of
accuracy, which is the honest way to make it: €1,740 in savings per site doesn't buy back even one
mistake, because the expensive error costs between 3 and 8 weeks of construction. Without
measuring, nothing changes.

## Consequences

**For**: it can be measured without spending on OpenAI (OpenRouter has `:free` models), choosing a
model per stage is one line, and rates can't drift apart from the model. Cost is tracked **per
tier**, so you know which stage is spending, not just the total.

**Against**: two providers is more surface area. Mitigated with `pnpm run providers:check`, which
validates, before spending, the three things that cost a demo: that the key exists, that the model
supports strict structured output — checked against OpenRouter's catalog — and that the rates are
declared.

**Pending**: measuring. Everything above is rate arithmetic; the silent error rate of the open
models hasn't been measured. Blocked by lack of API credit.

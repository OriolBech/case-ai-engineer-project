# ADR-005 · Declarative model tiers and OpenRouter as an open alternative

- **Date**: 2026-08-22
- **Status**: accepted
- **Partially supersedes**: ADR-003 (which fixed a single provider with models in loose
  variables)

## Context

Three things were pushing at once:

1. The measurement showed that **96% of cost at scale is output tokens**. The lever isn't the
   input cache: it's the model's output price.
2. `gpt-5.4-mini` gave a **50% silent error rate** and `gpt-5.4` gave 6.7%, while `gpt-5.5` gave
   0%. Dropping to a cheaper model isn't free, and it has to be changeable per stage rather than
   for everything at once.
3. The previous configuration had the model in one variable and its rates in three others. That's
   how a €/row figure quietly becomes false without anyone noticing: someone changes the model and
   the rate stays behind.

## Decision

**One tier = one line of configuration**, with the rates attached to the model:

```
LLM_MAIN=openai:gpt-5.5:5.00:30.00:0.50
LLM_CHEAP=openai:gpt-5.4:2.50:15.00:0.25
LLM_CRITIC=openrouter:openai/gpt-oss-120b:0.03:0.17
```

Three tiers with a defined role:

| Tier | For what | Criterion |
|---|---|---|
| `main` | Multi-element rows | That's where the attribution risk lives |
| `cheap` | Single-element rows | They have nowhere to go wrong |
| `critic` | The safety net | Can only downgrade → a weak model is safe here |

**OpenRouter as a second provider**, with the same `LlmProvider` interface. Nothing in
`src/pipeline` imports a provider SDK: switching from one to the other per stage is a single line
in `.env`.

## Why the critic is the natural home for the open model

Because its invariant bounds the damage. It can only downgrade, so disagreeing without reason adds
a line to the review queue (the cheap error) and agreeing when it shouldn't leaves the line as it
was (no protection gained, nothing lost). A component whose worst case is "no better than not
having it" doesn't need the expensive model.

## The open model's numbers

With the measured tokens (1,730 input / 652 output per row):

| Configuration | €/row | € per project (4,000 rows × 25 reviews) |
|---|---|---|
| `gpt-5.5` | 0.0175 | **1,749** |
| `gpt-5.4` | 0.0087 | 874 |
| `openai/gpt-oss-120b` (open) | 0.000095 | **9** |
| Manual baseline | 0.875 | 87,500 |

**This does not make the open model the right choice.** It turns the decision into a purely
accuracy-based one, which is the honest way to make it: €1,740 saved per project doesn't buy back
a single failure, because the costly error runs between 3 and 8 weeks of site delay. Without
measuring, nothing changes.

## Consequences

**For**: it's possible to measure without spending on OpenAI (OpenRouter has `:free` models), the
model choice per stage is a single line, and rates can't drift apart from the model. Cost is
tracked **per tier**, so it's clear which stage is spending, not just the total.

**Against**: two providers means more surface area. Mitigated with `npm run providers:check`,
which validates, before spending, the three things that cost a demo: that the key exists, that the
model supports strict structured output — checked against OpenRouter's catalog — and that the
rates are declared.

**Pending**: measuring it. Everything above is rate arithmetic; the silent error rate of the open
models isn't measured. Blocked by lack of API credit.

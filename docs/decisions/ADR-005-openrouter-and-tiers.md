# ADR-005 · Declarative model levels and OpenRouter as an open alternative

- **Date**: 2026-08-22
- **Status**: accepted
- **Partially supersedes**: ADR-003 (which pinned a single provider with models in loose
  variables)

## Context

Three things were pushing at once:

1. Measurement showed that **96% of the cost at scale is output tokens**. The lever isn't the
   input cache: it's the model's output price.
2. `gpt-5.4-mini` gave **50% silent error** and `gpt-5.4` gave 6.7%, while `gpt-5.5` gave 0%.
   Downgrading the model isn't free, and it must be possible to change it per stage rather than
   for everything at once.
3. The previous configuration had the model in one variable and its rates in three others. That's
   exactly how a €/row figure becomes false without anyone noticing: someone changes the model and
   the rate stays behind.

## Decision

**One level = one configuration line**, with the rates attached to the model:

```
LLM_MAIN=openai:gpt-5.5:5.00:30.00:0.50
LLM_CHEAP=openai:gpt-5.4:2.50:15.00:0.25
LLM_CRITIC=openrouter:openai/gpt-oss-120b:0.03:0.17
```

Three levels with a defined role:

| Level | For what | Criterion |
|---|---|---|
| `main` | Multi-element rows | Attribution risk exists there |
| `cheap` | Single-element rows | They have nowhere to go wrong |
| `critic` | The safety net | Can only downgrade → a weak model is safe here |

**OpenRouter as a second provider**, with the same `LlmProvider` interface. Nothing in
`src/pipeline` imports a provider SDK: switching from one to another per stage is one line in
`.env`.

## Why the critic is the natural place for the open model

Because its invariant bounds the damage. It can only downgrade, so disagreeing without reason adds
one line to the review queue (the cheap error), and agreeing when it shouldn't leaves the line as
it was (no protection gained, nothing lost). A component whose worst case is "no worse than not
having it" doesn't need the expensive model.

## The open model's numbers

With measured tokens (1,730 input / 652 output per row):

| Configuration | €/row | € per project (4,000 rows × 25 revisions) |
|---|---|---|
| `gpt-5.5` | 0.0175 | **1,749** |
| `gpt-5.4` | 0.0087 | 874 |
| `openai/gpt-oss-120b` (open) | 0.000095 | **9** |
| Manual baseline | 0.875 | 87,500 |

> **Correction 2026-08-24.** That table's denominator is 100,000 calls (fasteners only). All
> 20,000 rows must be read: **500,000 reads/project**. Honest figures: `gpt-oss-120b` **€48**,
> `gpt-5.5` **€8,750**. The conclusion doesn't change: cost isn't what decides; accuracy is.
> `docs/05-results.md` §7.

**This didn't make the open model the right choice** on the day of this ADR: it turned the
decision into a purely accuracy-based one. €1,740 of savings per project (with the denominator
used at the time) doesn't buy back a single failure. **It was measured afterward**
(`10-benchmarks.md` §2) and `gpt-oss-120b` matched `gpt-5.5`; that's why it's the delivered model.
Without that measurement, it would not have been changed.

## Consequences

**In favor**: it's possible to measure without spending on OpenAI (OpenRouter has `:free` models),
choosing a model per stage is one line, and rates can't diverge from the model. Cost is tallied
**per level**, so it's known which stage is spending, not just the total.

**Against**: two providers means more surface area. This is mitigated with
`pnpm run providers:check`, which validates, before any spend, the three things that cost a demo:
that the key exists, that the model supports strict structured output —checked against
OpenRouter's catalog— and that the rates are declared.

**Pending**: ~~measure. Everything above is rate arithmetic; the silent error of the open models
hasn't been measured. Blocked by lack of API credit.~~ **Done** (`10-benchmarks.md` §2):
`gpt-oss-120b` matches `gpt-5.5` on the gold set (0% silent error, 211/211) after deciding the name
from the table.

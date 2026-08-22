# SPEC-006 · Critic

| | |
|---|---|
| **File** | `src/pipeline/critic.ts` |
| **Stage** | 6 |
| **LLM** | **Yes** — selective |
| **Status** | ✅ **stays**, with one condition: it runs more than once. 90% aggregated precision; per-pass recall 14–71% |

## Purpose

An asymmetric second opinion on lines about to be output as `RESUELTA` with weak evidence. It's
the component that buys protection against the expensive error.

## Why an LLM

Detecting that the output **contradicts** the original text is comprehension, not field
comparison: a set element that got lost, a standard assigned to the wrong element, a quantity that
doesn't match the prose. A deterministic validator can't see it because it already validated
everything it knew how to validate.

## Contract

**Input**: a row's `OutputLine[]` + the original `sourceText`.
**Output**: `CriticVerdict[]` — `{ lineId, agrees: boolean, reason?: ReasonCode }`.

**Invariants** (all four tested)
- **It can only downgrade.** It never promotes a `REVISION_MANUAL` to `RESUELTA`. A critic that
  can promote is a second extractor with less information, and it raises silent error.
- **It runs based on decomposition risk, not on a scalar.** Multi-element rows, or ones with
  detected hallucination. The earlier design routed by confidence score and would have called the
  critic on **72%** of the lines: derived material (P-3) lowers the minimum for almost all of
  them, the score comes out nearly constant, and it's useless for routing. Attribution risk only
  exists where there's more than one element to attribute to. On the given MTO: **9 of 15 rows**.
- **If it fails, it doesn't break anything.** A safety net that goes down leaves the rule engine's
  verdict standing; failing the row because the optional check failed would be the worst outcome.
- The prompt is biased toward refuting. When in doubt, `agrees: false`.

## Why it's safe on a cheap or open model

Since it can only downgrade, its two failure modes are bounded and neither is dangerous:

| Critic failure | Consequence |
|---|---|
| Disagrees without reason | One more line in the review queue — the **cheap** error |
| Agrees when it shouldn't | The line stays as the rule engine left it — no protection gained, nothing lost |

A component whose worst case is *"no worse than not having it"* is the natural place for an open
model. Hence the `critic` level defaults to `openrouter:openai/gpt-oss-120b`, which bills output
at $0.17 per million versus `gpt-5.5`'s $30 — 176×, and output is 96% of the cost.

## Behavior

1. It's given the original text and the N proposed lines for that row.
2. It checks three things: (a) is any material mentioned in the text missing? (b) is any
   attribute assigned to the wrong element? (c) does any quantity contradict the prose?
3. If it detects something, it returns `agrees: false` with the reason, and the line moves to
   `REVISION_MANUAL` with `reason: CRITIC_DISAGREES` plus the detail.

## The real case that justifies the component

`gpt-5.4-mini` returned `ASTM F436` —a **standard**— as the washer's QUALITY in rows 1 and 5,
where the row gives no quality at all. The line came out `RESUELTA` instead of going to review.

And the span verifier **can't catch it**, because `ASTM F436` is indeed present in the text: the
failure is one of **attribution**, not invention. That's the exact gap this component covers, and
no other stage covers it.

## Acceptance criteria

- [x] Never changes a line from `REVISION_MANUAL` to `RESUELTA`. There is a test that verifies
      this.
- [x] Not called on single-element rows, out-of-family rows, empty rows, or failed rows.
- [x] A verdict on a nonexistent `lineId` is ignored instead of breaking things.
- [x] If the provider fails, the rule engine's verdict is kept.
- [x] Runs on 9 of 15 rows in the given MTO (60% of rows, not of lines).
- [x] Tolerates malformed responses from the provider. An open model doesn't always honor the
      strict schema: the absence of the `verdicts` field used to crash the run with a `.map` over
      `undefined`. A malformed safety net degrades to "no opinion," never to a crash.
- [~] **Lowers silent error**: yes in count (from 7 to 5 bad lines), no in rate (50% → 62.5%,
      because it also removes good lines from the resolved set). See `docs/02-kpi.md`: the rate
      alone isn't enough to evaluate this component, which is why the KPI now carries rate **and**
      count.
- [x] **Precision ≥70%.** **90% aggregated** (9 hits out of 10 downgrades) and ≥75% in each of the
      three passes, versus 33% for the previous version. The fix was giving it the **provenance**
      of each value, not switching models.
- [x] Measurable without the provider that produced the input: `gpt-5.4-mini`'s output is frozen in
      `data/eval/critic-baseline-gpt-5.4-mini.json`, and `scripts/critic-eval.ts` reproduces it at
      zero cost for the extractor. What counts as a real error is decided by the gold set, not a
      hand-written list.
- [ ] **Stable recall.** It varies 14–71% per pass on the same input. The union of three passes
      gives 71% for $0.0045 per MTO; it's still pending to implement and measure it instead of
      computing it.

## The decision · 2026-08-22

**It stays.** The stopping criterion was: tighten the prompt → if precision doesn't reach 70%,
change the model → if that doesn't work either, remove it. **It stopped at the first step.**

The blocker was never recall, it was the **31.8% noise** with 33% precision. The four false
positives all had the same shape, and the cause wasn't the model: it was given the
**normalized** output and asked to refute it against the **raw** text, with no way to know which
differences were the client's own tables. So it flagged them: `DIN931` "changed" to `ISO 4014`,
`zincado` "changed" to `CINCADO`, an `INOX` material "invented" from the `A4-70` quality. Three of
its seven discrepancies were exactly that, and each one cost a good line.

With each value's provenance in front of it (`normalized <- "literal" (provenance)`) and the task
explicitly stated —**you don't judge the transformation; you do judge the field and the
element**— precision goes from **33% to 90%**.

### And what only shows up when you repeat it

Three passes with `LLM_CACHE=off`, same input byte for byte, 9/9 rows each, no provider failures:

| Pass | Recall | Precision | Silent error |
|---|---|---|---|
| 1 | 14% (1/7) | 100% | 7 → 6 |
| 2 | 43% (3/7) | 75% | 7 → 4 |
| 3 | **71% (5/7)** | 100% | **7 → 2** |
| **Aggregate** | 9/21 | **90%** (9/10) | |
| **Union of the three** | **71%** (5/7) | **83%** (5/6) | |

**Recall varies by a factor of 5 on the same input.** That turns every single-pass figure in this
document into samples, not facts — including the 29% the previous version stated and a 0% I
measured myself before repeating it. A lone pass isn't enough to decide whether this component
stays, and it very nearly was decided on one.

**Why the variance here isn't dangerous, and is the property that saves the component.** The
critic **can only downgrade**. Variance in recall means uneven protection; variance in precision
would mean uneven damage. Precision is 90% aggregated and ≥75% across all three passes. A
component that sometimes protects and almost never gets in the way has its error on the good side
of the brief's asymmetry: 5 expensive errors avoided in the best pass versus 1 90-second review.

**Hence the condition.** Since it can only downgrade, repeating it and keeping the **union** is
safe by construction: each extra pass can only add catches, and each false positive costs one
review. The union of three gives **71% recall with 83% precision** for **$0.0045 per 15-row MTO**.
That figure is arithmetic over the three measured passes, not a run of the implemented function:
implementing and measuring it is the next step, and it's in `docs/11-benchmarks.md` §8.

**What it never catches.** `5.1` and `12.1` are missed in all three passes. It's not variance:
it's a limit. Both are the subtle `ASTM A193, GR B7` variant, where the value contains the correct
grade with the standard glued in front — there's nothing visibly out of place.

---

## Measured (2026-08-22, previous version · a single pass) · `openai/gpt-oss-120b` via OpenRouter

| | Value |
|---|---|
| Recall | **29%** (2 of 7 real errors from `gpt-5.4-mini`) |
| Precision | **33%** (2 of 6 downgrades) |
| Added tail noise | 0% → 31.8% |
| Cost | $0.0006 per 15-row MTO |
| Latency | 19 s per call |

The two hits are the predicted ones: the washers in rows 1 and 5, where `mini` put the standard
`ASTM F436` in the quality field. The five that are missed are the subtle variant,
`ASTM A193, GR B7`, where the value contains the correct grade with the standard glued in front.

**Plan, already executed**: tighten the prompt → precision 33% → **90%**. No need to change the
model or remove it. See "The decision" above.

## What happens to the KPI if this is removed

Measured on the frozen fixture, which is where there are errors to catch (on the real MTO the
current extractor makes none, so there the critic can only subtract):

| | Without critic | With critic (best pass) | With critic (worst pass) |
|---|---|---|---|
| Silent error (count) | 7 | **2** | 6 |
| Tail noise | 0% | 16.7% | 0% |
| Cost | 0 | +$0.0015 per 15-row MTO | same |

Removing it puts back between 1 and 5 silent errors into the order. Given the brief's asymmetry
—3–8 weeks of project delay versus a 90-second review— the math isn't close.

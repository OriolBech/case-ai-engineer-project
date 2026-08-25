# SPEC-006 · Critic

| | |
|---|---|
| **File** | `src/pipeline/critic.ts` |
| **Stage** | 6 |
| **LLM** | **Yes** — selective |
| **Status** | ✅ **stays as a selective single pass today**. 100% precision in the cited `high` pass; recall unstable at 14–71%. Merging three passes has been evaluated, not implemented |

## Purpose

An asymmetric second opinion on lines that are about to come out as `RESUELTA` with weak evidence.
It's the component that buys protection against the expensive error.

## Why an LLM

Detecting that the output **contradicts** the original text is comprehension, not field
comparison: a set element that got lost, a standard assigned to the wrong element, a quantity that
doesn't match the prose. A deterministic validator can't see it because it already validated what
it knew how to validate.

## Contract

**Input**: `OutputLine[]` for a row + the original `sourceText`.
**Output**: `CriticVerdict[]` — `{ lineId, agrees: boolean, reason?: ReasonCode }`.

**Invariants** (all four with a test)
- **Can only degrade.** Never promotes a `REVISION_MANUAL` to `RESUELTA`. A critic that can
  promote is a second extractor with less information, and it raises silent error.
- **Runs by decomposition risk, not by a scalar.** Multi-element rows, or ones with detected
  hallucination. The earlier design routed by confidence score and would have called the critic on
  **72%** of lines: derived material (P-3) lowers the floor for almost all of them, the score comes
  out nearly constant, and it's useless for routing. Attribution risk only exists where there's
  more than one element to attribute to. On the given MTO: **9 rows of 15**.
- **If it fails, it doesn't break — but it says so.** A safety net that goes down leaves the rules
  engine's verdict standing; failing the row because the optional check broke would be the worst
  outcome. What is unacceptable is it going down **silently**: `ran: false` used to mean both "not
  needed" and "broke and nobody noticed" at once. Now `CriticResult.failure` separates them, and
  failures are counted, named in the scripts, and shown on the buyer's panel.
- **Output budget: 8,192 tokens, not 2,048.** The tier reasons with `effort=high`, and on
  OpenRouter thinking tokens are billed against `max_tokens`, so at 2,048 the safety net was
  truncating exactly on the long rows — the ones that need it most. Caught on row 63 of the
  synthetic set, see `docs/03-policies.md` §P-10bis.
- The prompt is biased toward refuting. When in doubt, `agrees: false`.

## Why it's safe on a cheap or open model

Since it can only degrade, its two failure modes are bounded and neither is dangerous:

| Critic failure | Consequence |
|---|---|
| Disagrees for no reason | One more line in the review queue — the **cheap** error |
| Agrees when it shouldn't | The line stays as the rules engine left it — no protection gained, nothing lost |

A component whose worst case is *"no better than not having it"* is the natural place for an open
model. Hence the `critic` tier points by default to `openrouter:openai/gpt-oss-120b`, which bills
output at $0.17 per million against `gpt-5.5`'s $30 — 176×, and output is 96% of the cost.

## Behavior

1. It's given the original text and the N lines proposed for that row.
2. It checks three things: (a) is any material mentioned in the text missing? (b) is any attribute
   assigned to the wrong element? (c) does any quantity contradict the prose?
3. If it detects something, it returns `agrees: false` with the reason, and the line moves to
   `REVISION_MANUAL` with `reason: CRITIC_DISAGREES` plus the detail.

## The real case that justifies the component

`gpt-5.4-mini` returned `ASTM F436` — a **standard** — as the QUALITY of the washer in rows 1 and
5, where the row gives no quality at all. The line came out `RESUELTA` instead of going to review.

And the span verifier **doesn't detect it**, because `ASTM F436` really is in the text: the failure
is one of **attribution**, not invention. That's the exact gap this component covers, and no other
stage covers it.

## Acceptance criteria

- [x] Never changes a line from `REVISION_MANUAL` to `RESUELTA`. Verified by a test.
- [x] Not called on single-element rows, out-of-family, empty, or failed ones.
- [x] A verdict about a nonexistent `lineId` is ignored instead of breaking.
- [x] If the provider fails, the rules engine's verdict is kept, **and the failure is reported**:
      an unreviewed row must not be readable the same way as an approved one.
- [x] Runs on 9 of 15 rows in the given MTO (60% of rows, not of lines).
- [x] Tolerates malformed provider responses. An open model doesn't always honor the strict
      schema: a missing `verdicts` field used to crash execution with `.map` over `undefined`. A
      malformed safety net degrades to "no opinion," never to a crash.
- [~] **Lowers silent error**: yes in count (from 7 to 5 bad lines), no in rate (50% → 62.5%,
      because it also removes good lines from the resolved set). See `docs/02-kpi.md`: rate alone
      isn't enough to evaluate this component, which is why the KPI now carries both rate **and**
      count.
- [x] **Precision ≥70%.** **90% aggregate** (9 hits out of 10 degradations) and ≥75% in each of the
      three passes, against 33% for the earlier version. The fix was giving it the **provenance**
      of each value, not changing model.
- [x] Measurable without the provider that produced the input: `gpt-5.4-mini`'s output is frozen in
      `data/eval/critic-baseline-gpt-5.4-mini.json`, and `scripts/critic-eval.ts` reproduces it at
      zero cost for the extractor. What counts as a real error is decided by the gold, not a
      hand-built list.
- [ ] **Stable recall.** Varies 14–71% across passes on the same input. Merging three passes gives
      71% for $0.0045 per MTO; it still needs to be implemented and measured instead of calculated.

## The decision · 2026-08-22

**It stays.** The stop criterion was: tighten the prompt → if precision doesn't clear 70%, change
model → if that doesn't work either, drop it. **It stopped at the first step.**

The blocker was never recall, it was **31.8% noise** with 33% precision. The four false positives
all had the same shape, and the cause wasn't the model: it was given the **normalized** output and
asked to refute it against the **raw** text, with no way to know which differences were the
client's own tables. So it flagged them: `DIN931` "changed" to `ISO 4014`, `zincado` (zinc-plated)
"changed" to `CINCADO`, an `INOX` material "invented" from the `A4-70` quality. Three of its seven
disagreements were that, and each one cost a good line.

With each value's provenance shown up front (`normalized <- "literal" (provenance)`) and the task
stated explicitly — **you don't judge the transformation; you judge the field and the element** —
precision goes from **33% to 90%**.

### And what only shows up when you repeat it

Three passes with `LLM_CACHE=off`, same input byte for byte, 9/9 rows each time, no provider
failures:

| Pass | Recall | Precision | Silent error |
|---|---|---|---|
| 1 | 14% (1/7) | 100% | 7 → 6 |
| 2 | 43% (3/7) | 75% | 7 → 4 |
| 3 | **71% (5/7)** | 100% | **7 → 2** |
| **Aggregate** | 9/21 | **90%** (9/10) | |
| **Union of the three** | **71%** (5/7) | **83%** (5/6) | |

**Recall varies by a factor of 5 on the same input.** That turns every single-pass figure in this
document into a sample rather than a fact — including the 29% claimed in the earlier version and a
0% I myself measured before repeating. A single loose pass isn't enough to decide whether this
component stays, and it very nearly was.

**Why the variance here isn't dangerous, and is the property that saves the component.** The
critic **can only degrade**. Variance in recall means uneven protection; variance in precision
would mean uneven harm. Precision is 90% aggregate and ≥75% across all three passes. A component
that sometimes protects and almost never gets in the way has its error on the good side of the
brief's asymmetry: 5 expensive errors avoided in the best pass against 1 90-second review.

**Hence the condition.** Since it can only degrade, repeating it and keeping the **union** is safe
by construction: each extra pass can only add catches, and each false positive costs one review.
The union of three gives **71% recall at 83% precision** for **$0.0045 per 15-row MTO**. That
figure is arithmetic over the three measured passes, not a run of the implemented function:
implementing and measuring it is the next step, and it's in `docs/10-benchmarks.md` §8.

**What it never catches.** `5.1` and `12.1` slip past it in all three passes. It isn't variance:
it's a limit. Both are the subtle variant `ASTM A193, GR B7`, where the value contains the correct
grade with the standard stuck in front of it — nothing is visibly out of place.

---

## Measured (2026-08-22, earlier version · a single pass) · `openai/gpt-oss-120b` via OpenRouter

| | Value |
|---|---|
| Recall | **29%** (2 of 7 real `gpt-5.4-mini` errors) |
| Precision | **33%** (2 of 6 degradations) |
| Added tail noise | 0% → 31.8% |
| Cost | $0.0006 per 15-row MTO |
| Latency | 19 s per call |

The two hits are the predicted ones: the washers in rows 1 and 5, where `mini` put the standard
`ASTM F436` in the quality field. The five it misses are the subtle variant, `ASTM A193, GR B7`,
where the value contains the correct grade with the standard stuck in front of it.

**Plan, already executed**: tighten the prompt → precision 33% → **90%**. No need to change model
or drop it. See "The decision" above.

## What happens to the KPI if it's removed

Measured on the frozen fixture, which is where there are errors to catch (on the real MTO the
current extractor makes none, so there the critic can only subtract):

| | Without critic | With critic (best pass) | With critic (worst pass) |
|---|---|---|---|
| Silent error (count) | 7 | **2** | 6 |
| Tail noise | 0% | 16.7% | 0% |
| Cost | 0 | +$0.0015 per MTO | same |

Removing it puts between 1 and 5 silent errors back into the order. Given the brief's asymmetry —
3–8 weeks of construction against a 90-second review — the math isn't close.

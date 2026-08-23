# SPEC-006 · Critic

| | |
|---|---|
| **File** | `src/pipeline/critic.ts` |
| **Stage** | 6 |
| **LLM** | **Yes** — selective |
| **Status** | ✅ **stays**, with one condition: it runs more than once. 90% aggregate precision; 14–71% recall per pass |

## Purpose

An asymmetric second opinion on lines that are about to come out as `RESUELTA` (resolved) with
weak evidence. It's the component that buys protection against the expensive error.

## Why an LLM

Detecting that the output **contradicts** the original text is comprehension, not field
comparison: a set element that got lost, a standard assigned to the wrong element, a quantity
that doesn't match the prose. A deterministic validator can't see this because it already
validated everything it knew how to validate.

## Contract

**Input**: `OutputLine[]` for a row + the original `sourceText`.
**Output**: `CriticVerdict[]` — `{ lineId, agrees: boolean, reason?: ReasonCode }`.

**Invariants** (all four have tests)
- **It can only downgrade.** It never promotes a `REVISION_MANUAL` (manual review) to `RESUELTA`
  (resolved). A critic that can promote is a second extractor with less information, and it
  raises the silent-error rate.
- **It runs based on attribution risk, not on a scalar.** Multi-element rows, or ones with a
  detected hallucination. The earlier design routed on the confidence score and would have called
  the critic on **72%** of the lines: derived material (P-3) lowers the minimum for almost all of
  them, the score comes out nearly constant, and it's useless for routing. Attribution risk only
  exists where there is more than one element to attribute to. On the given MTO: **9 of 15
  rows**.
- **If it fails, it doesn't break — but it says so.** A safety net that goes down leaves the rule
  engine's verdict standing; failing the row because the optional check failed would be the
  worst outcome. What is unacceptable is for it to go down **silently**: `ran: false` used to
  mean both "wasn't needed" and "broke and nobody noticed" at the same time. Now
  `CriticResult.failure` separates them, and failures are counted, named in the scripts, and
  shown on the buyer's dashboard.
- **Output budget: 8,192 tokens, not 2,048.** The tier reasons with `effort=high`, and on
  OpenRouter thinking tokens are billed against `max_tokens`, so at 2,048 the safety net was
  getting truncated right on the long rows — the ones that need it most. This was caught on row
  63 of the synthetic set, see `docs/03-policies.md` §P-10bis.
- The prompt is biased toward refuting. When in doubt, `agrees: false`.

## Why it's safe on a cheap or open model

Since it can only downgrade, its two failure modes are bounded and neither is dangerous:

| Critic failure | Consequence |
|---|---|
| Disagrees without reason | One more line in the review queue — the **cheap** error |
| Agrees when it shouldn't | The line stays as the rule engine left it — no protection gained, nothing lost |

A component whose worst case is *"no worse than not having it"* is the natural place for an open
model. That's why the `critic` tier defaults to `openrouter:openai/gpt-oss-120b`, which bills
output at $0.17 per million versus $30 for `gpt-5.5` — 176×, and output is 96% of the cost.

## Behavior

1. It's given the original text and the N proposed lines for that row.
2. It checks three things: (a) is any material mentioned in the text missing? (b) is any
   attribute assigned to the wrong element? (c) does any quantity contradict the prose?
3. If it detects something, it returns `agrees: false` with the reason, and the line moves to
   `REVISION_MANUAL` (manual review) with `reason: CRITIC_DISAGREES` plus the detail.

## The real case that justifies the component

`gpt-5.4-mini` returned `ASTM F436` — a **standard** — as the washer's QUALITY on rows 1 and 5,
where the row doesn't give any quality at all. The line came out `RESUELTA` (resolved) instead
of going to review.

And the span verifier **doesn't catch it**, because `ASTM F436` really is in the text: the
failure is one of **attribution**, not invention. That is exactly the gap this component covers,
and no other stage covers it.

## Acceptance criteria

- [x] Never changes a line from `REVISION_MANUAL` (manual review) to `RESUELTA` (resolved). Verified by test.
- [x] Not called on single-element rows, out-of-family rows, empty rows, or failed rows.
- [x] A verdict for a nonexistent `lineId` is ignored instead of breaking.
- [x] If the provider fails, the rule engine's verdict is kept, **and the failure is reported**:
      an unreviewed row can't be read the same way as an approved row.
- [x] Runs on 9 of 15 rows in the given MTO (60% of rows, not of lines).
- [x] Tolerates malformed responses from the provider. An open model doesn't always honor the
      strict schema: the absence of the `verdicts` field used to crash execution with a `.map`
      call on `undefined`. A malformed safety net degrades to "no opinion," never to a crash.
- [~] **Lowers the silent error**: in count, yes (from 7 to 5 bad lines); in rate, no (50% → 62.5%,
      because it also pulls good lines out of the resolved set). See `docs/02-kpi.md`: the rate
      alone isn't enough to evaluate this component, which is why the KPI now carries both rate
      **and** count.
- [x] **Precision ≥70%.** **90% aggregate** (9 hits out of 10 downgrades) and ≥75% on each of the
      three passes, versus 33% for the earlier version. The fix was giving it the **provenance**
      of each value, not switching models.
- [x] Measurable without the provider that produced the input: `gpt-5.4-mini`'s output is frozen
      in `data/eval/critic-baseline-gpt-5.4-mini.json` and `scripts/critic-eval.ts` reproduces it
      at zero extractor cost. What counts as a real error is decided by the gold set, not a
      hand-picked list.
- [ ] **Stable recall.** It varies 14–71% per pass on the same input. The union of three passes
      gives 71% for $0.0045 per MTO; it still needs to be implemented and measured instead of
      calculated.

## The decision · 2026-08-22

**It stays.** The stopping criterion was: harden the prompt → if precision doesn't clear 70%,
switch models → if that doesn't work either, remove it. **It stopped at the first step.**

The blocker was never recall, it was **31.8% noise** with 33% precision. All four false
positives had the same shape, and the cause wasn't the model: it was being given the
**normalized** output and asked to refute it against the **raw** text, with no way of knowing
which differences came from the client's own tables. So it flagged them: `DIN931` "changed" to
`ISO 4014`, `zincado` "changed" to `CINCADO`, an `INOX` material "invented" from the `A4-70`
quality. Three of its seven discrepancies were exactly that, and each one cost a good line.

With each value's provenance in front of it (`normalized <- "literal" (provenance)`) and the task
stated explicitly — **you don't judge the transformation; you judge the field and the
element** — precision goes from **33% to 90%**.

### And what only shows up when you repeat it

Three passes with `LLM_CACHE=off`, byte-for-byte identical input, 9/9 rows each time, no
provider failures:

| Pass | Recall | Precision | Silent error |
|---|---|---|---|
| 1 | 14% (1/7) | 100% | 7 → 6 |
| 2 | 43% (3/7) | 75% | 7 → 4 |
| 3 | **71% (5/7)** | 100% | **7 → 2** |
| **Aggregate** | 9/21 | **90%** (9/10) | |
| **Union of the three** | **71%** (5/7) | **83%** (5/6) | |

**Recall varies by a factor of 5 on the same input.** That turns every single-pass figure in this
document into a sample, not a fact — including the 29% the earlier version reported, and a 0% I
measured myself before repeating it. A single loose pass isn't enough to decide whether this
component stays, and it very nearly was decided with one.

**Why the variance here isn't dangerous, and is the property that saves the component.** The
critic **can only downgrade**. Variance in recall means uneven protection; variance in precision
would mean uneven damage. Precision is 90% aggregate and ≥75% across all three passes. A
component that sometimes protects and almost never gets in the way sits on the good side of the
brief's asymmetry: 5 expensive errors avoided on the best pass, versus 1 review that takes 90 s.

**Hence the condition.** Since it can only downgrade, repeating it and keeping the **union** is
safe by construction: every extra pass can only add catches, and every false positive costs one
review. The union of three gives **71% recall at 83% precision** for **$0.0045 per 15-row MTO**.
That figure is arithmetic over the three measured passes, not a run of the implemented function:
implementing and measuring it is the next step, and it's covered in `docs/11-benchmarks.md` §8.

**What it never catches.** `5.1` and `12.1` slip past it in all three passes. It's not variance:
it's a limit. Both are the subtle variant `ASTM A193, GR B7`, where the value contains the
correct grade with the standard stuck in front of it — nothing is visibly out of place.

---

## Measured (2026-08-22, earlier version · single pass) · `openai/gpt-oss-120b` via OpenRouter

| | Value |
|---|---|
| Recall | **29%** (2 of 7 real errors from `gpt-5.4-mini`) |
| Precision | **33%** (2 of 6 downgrades) |
| Noise added to queue | 0% → 31.8% |
| Cost | $0.0006 per 15-row MTO |
| Latency | 19 s per call |

The two hits are the predicted ones: the washers on rows 1 and 5, where `mini` put the `ASTM
F436` standard in the quality field. The five that get away are the subtle variant, `ASTM A193,
GR B7`, where the value contains the correct grade with the standard stuck in front of it.

**Plan, already executed**: harden the prompt → precision 33% → **90%**. No need to switch
models or remove it. See "The decision" above.

## What happens to the KPI if it's removed

Measured on the frozen fixture, which is where there are errors to catch (on the real MTO the
current extractor makes none, so there the critic can only subtract):

| | Without critic | With critic (best pass) | With critic (worst pass) |
|---|---|---|---|
| Silent error (count) | 7 | **2** | 6 |
| Queue noise | 0% | 16.7% | 0% |
| Cost | 0 | +$0.0015 per 15-row MTO | same |

Removing it returns between 1 and 5 silent errors to the order. Given the brief's asymmetry — 3–8
weeks of site delay versus a 90-second review — the math isn't even close.

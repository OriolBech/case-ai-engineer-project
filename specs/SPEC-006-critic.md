# SPEC-006 · Critic

| | |
|---|---|
| **File** | `src/pipeline/critic.ts` |
| **Stage** | 6 |
| **LLM** | **Yes** — selective |
| **Status** | ⚠️ implemented and measured · **not yet production-ready**: recall 29%, precision 33% |

## Purpose

An asymmetric second opinion on lines that are about to come out as `RESUELTA` on weak evidence.
This is the component that buys protection against the costly error.

## Why an LLM

Detecting that the output **contradicts** the original text is comprehension, not field
comparison: a lost set element, a standard assigned to the wrong element, a quantity that doesn't
match the prose. A deterministic validator can't see it, because it already validated everything
it knew how to validate.

## Contract

**Input**: `OutputLine[]` for a row + the original `sourceText`.
**Output**: `CriticVerdict[]` — `{ lineId, agrees: boolean, reason?: ReasonCode }`.

**Invariants** (all four with a test)
- **Can only downgrade.** It never promotes a `REVISION_MANUAL` to `RESUELTA`. A critic that can
  promote is a second extractor with less information, and it raises the silent error rate.
- **Runs based on decomposition risk, not a scalar.** Multi-element rows, or rows with a detected
  hallucination. The previous design routed by confidence score and would have called the critic
  on **72%** of lines: the derived material (P-3) lowers the minimum on almost every one, the
  score comes out nearly constant, and it's useless for routing. Attribution risk only exists
  where there is more than one element to attribute to. On the given MTO: **9 rows out of 15**.
- **If it fails, it doesn't break anything.** A safety net that goes down leaves the rules
  engine's verdict standing; failing the row because the optional check failed would be the
  worst possible outcome.
- The prompt is biased toward refuting. When in doubt, `agrees: false`.

## Why it's safe on a cheap or open model

Since it can only downgrade, its two failure modes are bounded and neither is dangerous:

| Critic failure | Consequence |
|---|---|
| Disagrees without reason | One more line in the review queue — the **cheap** error |
| Agrees when it shouldn't | The line stays as the rules engine left it — no protection gained, nothing lost |

A component whose worst case is *"no better than not having it"* is the natural place for an open
model. That's why the `critic` level defaults to `openrouter:openai/gpt-oss-120b`, which bills
output at $0.17 per million against $30 for `gpt-5.5` — 176×, and output is 96% of the cost.

## Behavior

1. It's given the original text and the N proposed lines for that row.
2. It checks three things: (a) is any material mentioned in the text missing? (b) is any attribute
   assigned to the wrong element? (c) does any quantity contradict the prose?
3. If it detects something, it returns `agrees: false` with the reason, and the line moves to
   `REVISION_MANUAL` with `reason: CRITIC_DISAGREES` plus the detail.

## The real case that justifies the component

`gpt-5.4-mini` returned `ASTM F436` —a **standard**— as the washer's QUALITY in rows 1 and 5,
where the row gives no quality at all. The line came out `RESUELTA` instead of going to review.

And the span verifier **doesn't catch it**, because `ASTM F436` really is in the text: the failure
is one of **attribution**, not invention. That's exactly the gap this component covers, and no
other stage covers it.

## Acceptance criteria

- [x] Never changes a line from `REVISION_MANUAL` to `RESUELTA`. Test that verifies it.
- [x] Not called on single-element rows, out-of-family rows, empty rows, or failed rows.
- [x] A verdict on a nonexistent `lineId` is ignored instead of breaking.
- [x] If the provider fails, the rules engine's verdict is preserved.
- [x] Runs on 9 of 15 rows in the given MTO (60% of rows, not of lines).
- [x] Tolerates malformed responses from the provider. An open model doesn't always honor the
      strict schema: the absence of the `verdicts` field used to crash the run with a `.map` over
      `undefined`. A malformed safety net degrades to "no opinion," never to a crash.
- [~] **Lowers the silent error**: in count, yes (from 7 to 5 bad lines); in rate, no (50% → 62.5%,
      because it also pulls good lines out of the resolved set). See `docs/02-kpi.md`: rate alone
      isn't enough to evaluate this component, which is why the KPI now carries both rate **and**
      count.
- [ ] **Precision ≥70%.** Current: 33% (4 false positives out of 6 downgrades), with 31.8% noise
      in the queue. That's the blocker: the case statement warns that a noisy queue makes the
      buyer stop looking at it, and that destroys the whole protection.

## Measured (2026-08-22) · `openai/gpt-oss-120b` via OpenRouter

| | Value |
|---|---|
| Recall | **29%** (2 of 7 real errors from `gpt-5.4-mini`) |
| Precision | **33%** (2 of 6 downgrades) |
| Added queue noise | 0% → 31.8% |
| Cost | $0.0006 per 15-row MTO |
| Latency | 19 s per call |

The two hits are the predicted ones: the washers in rows 1 and 5, where `mini` put the standard
`ASTM F436` in the quality field. The five that get away are the subtler variant, `ASTM A193, GR
B7`, where the value contains the correct grade with the standard stuck in front of it.

**Plan**: harden the prompt (the 4 false positives share the same shape: it flags empty fields and
confuses finish with material) → if precision doesn't clear 70%, change the `critic` level's
model → if that fails too, remove the component and document it in `docs/08-not-done.md`.

## What happens to the KPI if it's removed

`silent_error_rate` goes up and cost/line goes down. It's an explicit trade-off, and the number
decides whether the component stays. Measured: _pending_.

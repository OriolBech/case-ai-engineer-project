# Results

> Status: 🚧. Feeds section 3 of the 2-pager. Measured with `npm run eval`.
> **Measurement is halted**: API credit ran out mid-benchmark (2026-08-22).

## Against the gold set (15 rows → 30 lines)

`gpt-5.5`, 3 repetitions, identical result across all three:

| Metric | Value |
|---|---|
| **Silent error** (primary) | **0.0%** — 0 of 15 resolved |
| **Useful autonomy** | **50.0%** — 15 of 30 |
| **Split fidelity** | **100%** — 15 of 15 rows |
| **Queue noise** | **0.0%** — 0 of 15 reviews |
| Status agreement | 100% |
| Exact reasons | 100% |
| Span hallucinations | 0 |

Breakdown by attribute: **210 of 210 cells correct**, including the 27 policy-dependent ones.

| Attribute | Certain | Policy |
|---|---|---|
| name | 30/30 | — |
| material | 13/13 | 17/17 |
| quality | 30/30 | — |
| measure | 30/30 | — |
| length | 27/27 | 3/3 |
| standard | 30/30 | — |
| finish | 23/23 | 7/7 |

**The mandatory caveat about this 100%.** It's 30 lines, and I wrote both the gold set **and** the
prompt. A blind spot shared between the two isn't detected by this measurement. What backs the number
up against that are the 64 targeted synthetic rows —written from coverage gaps, not from the
MTO— where the 12 planted tests trigger correctly. And the blind set from the session day is
the real proof.

## Sweep of open models (OpenRouter)

`npm run sweep` · 7 models × 15 rows · critic off (this measures the extractor) ·
**total sweep cost: €0.055**

| Model | $/M output | Silent error | Autonomy | **Split** | Noise | €/row |
|---|---|---|---|---|---|---|
| `gpt-5.5` (reference) | 30.00 | **0%** | **50.0%** | **100%** | 0% | 0.0239 |
| **`moonshotai/kimi-k3`** | 15.00 | **0%** | **50.0%** | **100%** | **0%** | **0.0169** |
| **`openai/gpt-oss-120b`** | **0.17** | 13% (2) | **43.3%** | **100%** | 0% | 0.000095 |
| `qwen/qwen3-235b-a22b-2507` | 0.55 | 21% (3) | 36.7% | **100%** | 6% | 0.00005 |
| `deepseek/deepseek-v3.2` | 0.40 | 0% | 40.0% | 93% | 13% | 0.00031 |
| `deepseek/deepseek-v4-pro-0813` | 3.56 | 0% | 23.3% | 60% | 14% | 0.0014 |
| `z-ai/glm-5.2` | 3.04 | 33% (2) | 13.3% | 53% | 17% | 0.0019 |
| `qwen/qwen3.8-max` | 6.00 | 0% | **0.0%** | 40% | 67% | — |

### 0. `kimi-k3` matches `gpt-5.5` exactly

**210 of 210 cells correct, all seven attributes at 100%, 0% silent error, 100% split,
0% noise.** The only open model that reproduces the reference without a single difference, and at
half the output rate (15.00 vs. 30.00 $/M) and 29% less measured cost per row.

What this buys isn't cost —it's €500 per job on top of an €87,500 baseline, noise— but rather
**removing vendor lock-in from the quality equation**. The client commitment stops
depending on a specific provider, and that's an argument that holds up to a procurement director's
question.

Sample-size caveat: "perfect" on 30 lines doesn't distinguish `kimi-k3` from `gpt-5.5`. What
the sample does support is elimination: the five models that break sets are ruled out without discussion.

### 1. Price doesn't predict quality

Sorted by output price, quality **doesn't** follow:

| $/M output | 30.00 | **15.00** | 6.00 | 3.56 | 3.04 | 0.55 | 0.40 | **0.17** |
|---|---|---|---|---|---|---|---|---|
| Split fidelity | 100% | **100%** | 40% | 60% | 53% | 100% | 93% | **100%** |

**The cheapest open model on the list is the best open model on the list**, and it beats models
that cost 35× more on output. `qwen3.8-max` at $6/M is the worst of the seven. Choosing the model by
price would have been choosing wrong.

### 2. `qwen3.8-max` is the degenerate case the brief warns about

0% silent error **because it resolves nothing**: 0% autonomy, 67% queue noise. It's
literally *"a system that gets 100% right by sending 90% of the rows to review is useless."*

And it's proof the KPI works: sorted by silent error alone, this model comes out
**first**. All four metrics together are needed for it to end up last, which is where it belongs.

### 3. Split fidelity is what separates them

Only three models hold 100%: `gpt-5.5`, `gpt-oss-120b` and `qwen3-235b`. The rest break between
7% and 60% of the sets. And breaking a set isn't a wrong attribute: it's **a material nobody
buys**. That's the reason to report it separately rather than averaged, and it confirms that set
explosion is "the most expensive rule" for the models too.

### 4. An artifact of my own harness, which has to be disclosed

**The 0% silent error of `deepseek-v3.2`, `v4-pro` and `qwen3.8-max` is not comparable with `gpt-5.5`'s.**
When the split fails, the lines don't align with the gold set and the harness can't
compare them, so fewer lines enter the denominator. A model that can't split sets gets a
favored silent-error figure.

Rule that follows: **silent error is only meaningful alongside split fidelity.** Below
100% split, the silent-error figure isn't reliable. Added as a caveat in `02-kpi.md`.

### 5. The only thing `gpt-oss-120b` gets wrong is the attribute the tables already get right

Its breakdown: `name` **93%**, and the other six at **100%**.

| Model | name | material | quality | measure | length | standard | finish |
|---|---|---|---|---|---|---|---|
| `gpt-5.5` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `kimi-k3` | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| `gpt-oss-120b` | **93%** | 100% | 100% | 100% | 100% | 100% | 100% |
| `qwen3-235b` | 87% | 92% | 97% | 100% | 100% | 100% | 100% |
| `deepseek-v3.2` | 96% | 100% | 96% | 96% | 96% | 96% | 95% |
| `deepseek-v4-pro` | 79% | 80% | 86% | 79% | 75% | 79% | 75% |
| `glm-5.2` | 83% | 100% | 67% | 83% | 90% | 83% | 90% |

Its 2 failures are on **name** — and name is precisely the attribute `src/rules/names.ts` gets right
100% of the time without a model. Right now `normalize.ts` keeps the model's name. Preferring the
table's when deterministic detection is unambiguous should take `gpt-oss-120b` from 13% to ~0%
silent error **for free**, without changing models.

That's the next iteration, and it's the kind of improvement that only shows up by looking at the
per-attribute breakdown instead of the aggregate.

### 6. The three configurations still on the table

| | Quality | €/row | € per job | Argument |
|---|---|---|---|---|
| `gpt-5.5` | perfect | 0.0239 | 1,749 | The reference. Latency with 9× variance |
| `kimi-k3` | **perfect** | 0.0169 | ~1,240 | Same quality without vendor lock-in |
| `gpt-oss-120b` | 13% silent err. | **0.000095** | **9** | 178× cheaper; its only failure is the name, and the tables get the name right |

If preferring the table for the name gets `gpt-oss-120b` to 0%, the third row wins without
discussion and the other two remain as calibration references. If it doesn't, the choice is
`kimi-k3`: same quality as the reference, with no vendor dependency.

## Model comparison (OpenAI)

| Configuration | Silent error | Autonomy | Split | €/row | model-s/row | Reps |
|---|---|---|---|---|---|---|
| **gpt-5.5** | **0.0%** | 50.0% | 100% | 0.0235 | avg 44.0 · range **6.9–64.5** | 3 |
| **mixed 5.5/5.4** | **0.0%** | 50.0% | 100% | 0.0192 | 6.4 | 1 |
| gpt-5.4 | 6.7% | 46.7% | 100% | 0.0145 | 2.6 | 1 |
| gpt-5.4-nano | 30.8% | 30.0% | 100% | 0.0179 | 3.2 | 1 |
| gpt-5.4-mini | **50.0%** | 23.3% | 100% | 0.0102 | 2.1 | 1 |

### The cost of downgrading models

`gpt-5.4-mini` doesn't fail randomly. In rows 1 and 5 **the washer has no quality** —the
cause of 87% of the review queue— and mini filled in the quality with `ASTM F436`, which is the *standard*.
The line came out **RESUELTA** instead of going to review: the wrong material on site, and nobody
detects it because the line looks resolved.

And the span verifier **doesn't catch it**, because `ASTM F436` really is in the text. The failure is one
of **attribution**, not invention. This is the gap that justifies the critic (SPEC-006).

`gpt-5.4` fails once out of fifteen, also on the expensive side: it dropped the `zincado` from row 6,
so it would buy a bare screw instead of a zinc-plated one — which, under the no-mixing rule, is a
different material.

### Mixed routing

`gpt-5.5` for the 9 multi-element rows, `gpt-5.4` for the 6 simple ones. Deterministic router, 0
calls to decide. Result: **same silent error (0%), same autonomy (50%), 18% cheaper**. Latency with a single
repetition came out at 6.4 s/row, but a single latency measurement isn't a measurement.

## Latency isn't measurable with a single pass

`gpt-5.5` gave **6.9, 44 and 64.5 s/row** across three identical runs: a factor of 9.

That invalidates an argument I had built myself: I said `5.5` was ~10× slower than
`5.4` based on a measurement of 24.8 s/row, and the next pass gave 7.4 s under the same
conditions. **Cost is stable (±5%) because tokens are nearly deterministic; latency isn't stable
at all.**

Consequence for the client commitment: latency can't be promised with this model,
because the variance belongs to the provider and I don't control it. What can be promised is
throughput with a margin and a plan for when it falls outside range. The "minutes for 1,000 lines"
figure has to come with its range, not as a single number.

## The critic: first result, and it's negative

`openai/gpt-oss-120b` via OpenRouter, 9 multi-element rows, over the mixed pipeline that without
the critic produced 0% silent error.

| | Without critic | With critic |
|---|---|---|
| Silent error | 0.0% | 0.0% |
| **Useful autonomy** | **50.0%** | **26.7%** |
| **Queue noise** | **0.0%** | **31.8%** |
| Status agreement | 100% | 76.7% |
| Cost | — | $0.0015 / 9 calls |
| Latency | — | 14.5 s per call |

**It downgraded 7 of the 8 correctly resolved lines**: 2.1, 3.1, 4.1, 6.1, 7.1, 7.2, 9.1. All of them
are marked correct by the gold set.

And a telling domain failure: on row 8 it warned that "the material=ZN fields are missing on
lines 8.2 and 8.3." `ZN` is a **finish** (CINCADO), not a material. The critic doesn't distinguish the
two attributes.

**By the acceptance criterion I myself wrote in SPEC-006 —"if it doesn't measurably lower the silent
error, remove it"— this critic gets removed.** It doesn't lower anything (it was already at 0) and it
raises queue noise to 31.8%, which is exactly the failure the brief calls invisible: if the queue
fills up with noise, the buyer stops looking at it and the protection against the expensive error is
lost too.

### What this experiment does and doesn't measure

It measures the **false-positive rate**, and it's unacceptable: 7 of 8.

**It doesn't measure the hit rate**, because on a pipeline with 0% silent error the critic has
nothing to find. Measuring a safety net on an error-free pass can only measure its
false alarms.

## The experiment that does measure the hit rate

The critic against `gpt-5.4-mini`'s output, which has **7 known real errors**.

| | Without critic | With critic |
|---|---|---|
| Silent error (rate) | 50.0% (7/14) | **62.5%** (5/8) |
| Bad resolved lines (count) | **7** | **5** |
| Useful autonomy | 23.3% | 10.0% |
| Queue noise | 18.8% | 31.8% |

Breakdown of the 6 lines it downgraded, against the 7 real errors:

| | Lines | |
|---|---|---|
| **Hits** | `1.3`, `5.3` | **2** — the washers with `ASTM F436` inserted as quality |
| False positives | `2.1`, `7.1`, `7.2`, `9.1` | 4 |
| Missed | `1.1`, `1.2`, `5.1`, `5.2`, `12.1` | 5 |

**Recall 29% · Precision 33%.**

### The concept works; the implementation doesn't get there

The two hits are exactly the ones I predicted only this component could catch: the washer
with no quality where `mini` put a **standard** in the quality field. No other stage sees it — the
span verifier doesn't either, because `ASTM F436` really is in the text. So the gap exists and the
critic covers it.

The five it misses are the subtle variant: `ASTM A193, GR B7` as the quality, where the value
**contains** the correct grade with the standard stuck in front of it. It's a harder error to spot than
plain `ASTM F436`.

## A flaw in my own KPI, which this experiment exposed

**My primary metric is a rate, and that's why it says the critic makes things worse when in
reality it makes them better.**

In absolute count, the critic removed **2 bad lines and 4 good ones** from the resolved set. The
numerator dropped from 7 to 5 —two fewer expensive errors— but the denominator dropped from 14 to 8, so
the *rate* rose from 50% to 62.5%.

And the two things it removes aren't worth the same, which is the premise of the whole case:

| | Count | Unit cost |
|---|---|---|
| Expensive errors avoided | 2 | 3–8 weeks of delay on a construction front |
| Unnecessary reviews added | 4 | ~90 s of buyer time ≈ €3.5 total |

With that asymmetry, the trade-off is overwhelmingly good, and my main metric reads it as a
worsening. **The rate needs to be accompanied by the absolute count of expensive errors avoided**, or
the KPI penalizes exactly the component that protects against the costliest error.

What does remain a real problem, not a measurement one, is the **31.8% queue noise**: the
brief warns that a noisy queue makes the buyer stop looking at it, and that destroys the
entire protection. No per-line cost captures that systemic effect.

### Verdict

The component **stays, but not in this state.** Next up is the prompt, because the four
false positives all have the same shape: it flags empty fields —I explicitly told it an
empty field isn't an error— and confuses finish with material. If after toughening it precision doesn't
rise above 70%, the `critic` tier's model gets changed; and if that doesn't work either, it gets removed and
documented in `08-not-done.md`.

### Hypotheses, in order of probability

1. **The prompt.** It's a first draft. The failures look like misunderstood instructions: I
   explicitly told it an empty field isn't an error, and it flags empty fields; and it confuses finish
   with material, a distinction the prompt doesn't explain.
2. **The model.** `gpt-oss-120b` may lack the necessary domain judgment. But if an expensive
   model is needed here, the argument that the critic is the natural place for the cheap model falls apart,
   and with it the component's economics.
3. **The component.** Maybe post-hoc verification is the wrong approach and the
   effort would pay off better by toughening the extractor's prompt.

## Pending

- [ ] Repetitions of the mixed and `5.4` configurations (blocked: no API credit).
- [ ] Toughen the prompt at the point where `mini` failed (a standard isn't a quality) and re-measure
      all three. The current comparison uses a prompt tuned on `5.5`, so it measures
      "mini with 5.5's prompt," not mini's actual capability.
- [ ] Diff `5.4` against `5.5` over the 64 synthetic rows, adjudicating only the discrepancies
      by hand. Multiplies the sample by 2.4 without labeling 71 lines.
- [ ] The critic, and with it the second axis of silent error.

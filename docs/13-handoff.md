# Handoff · prompt to continue in another session

Copy from `---` to `---`.

---

I'm continuing an AI Engineer technical case for Sapira: extraction and normalization of fastener
lines from MTOs (engineering Excel files). The repo is on `main`, clean and in sync with
`origin/main`. 31 commits, `npx tsc --noEmit` clean, 88/88 tests, 0 vulnerabilities.

**Read first, in this order:** `docs/README.md` (index), `docs/11-benchmarks.md` (every
measurement with its method and limits), `docs/03-policies.md` (the 9 policies), and
`docs/12-system-behind-the-rules.md`. Don't re-derive any of that: it's already measured and
argued.

## Invariants that must NOT be broken

Each one cost a real error. They're in the code comments with their rationale.

1. **Only the measure is extrapolated.** Confirmed by the client on 2026-08-22. Not quality, not
   finish. A row-level finish left unattributed goes to review (`FINISH_SCOPE_UNSTATED`), it isn't
   resolved as blank: asserting its absence changes which reference gets purchased.
2. **The name is decided by the table, not the model.** `findNames` over the literal term wins.
   This one was worth 13 points of silent error.
3. **Quality is emitted exactly as written**, never the group's representative value. `A4-70` is
   narrower than `A4`.
4. **Never convert between quality groups.** `8.8` (G5) is not `8` (G8).
5. **A row never disappears.** 0 elements → `NO_ELEMENTS_EXTRACTED`. A missing line reads as "there
   is nothing to buy here."
6. **Metrics are computed over CIERTA [certain] cells** in the gold set (190/210). The 20
   policy-dependent ones are reported separately as sensitivity.
7. **Silent error only makes sense read alongside split fidelity.** A model that never splits sets
   gets a flattering number because the harness aligns fewer lines.
8. **The cache only covers the model call**, never the normalizer or the validator: toggling a
   `POLICY_*` flag in the demo has to actually show up.
9. **Cost and latency are measured with `LLM_CACHE=off`.** Measuring against the cache measures the
   cache.
10. **Comparing models requires an identical prompt and an identical provider.** I nearly published
    a false conclusion by comparing two different prompts.
11. **Latency needs repeated runs.** `gpt-5.5` gave 6.9 · 44.0 · 64.5 s/row across three identical
    passes.
12. **`app/` belongs to another session.** Reading it is fine, touching it isn't without asking
    first.

## Environment

- **No OpenAI credit.** Everything runs through OpenRouter, which works.
  `LLM_MAIN=openrouter:openai/gpt-oss-120b:0.03:0.17` matches `gpt-5.5` on the gold set and costs
  176× less on output. The `gpt-5.5` cache only serves the gold set, and only with the current
  prompt.
- Node 26 runs TypeScript natively: no build step, `.ts`-extension imports, and **no parameter
  properties, `enum`, or `namespace`** (strip-only mode).
- Commands: `npm run check` · `eval` · `sweep` · `gaps` · `cost` · `variants` · `providers:check` ·
  `inspect` · `run`.

## Pending work, by return on effort

### 1. Prompt: comma-separated series of elements  ·  ~€0.05
Row 63 of the synthetic set is missed by both good models:
`Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado`.
It lists elements as a **comma-separated series**, and every example in `src/pipeline/prompts.ts`
uses a connector (`with`, `con`, `W/2`, `c/w`). Add the pattern, re-measure gold + synthetic,
confirm the gold set still sits at 0% silent error and the synthetic lines go from 69 to 71.

### 2. The critic: tighten it or drop it  ·  ~€0.01
Today: 29% recall, 33% precision, **31.8% noise in the queue**. The stopping criterion is already
written in `specs/SPEC-006-critic.md`: tighten the prompt → if precision doesn't clear **70%**,
change the `critic` tier's model → if that still doesn't work, **drop it** and document it in
`docs/08-not-done.md`. The 4 false positives share the same shape: flagging empty fields (the
prompt already says an empty field isn't an error) and confusing finish with material (`ZN` is
CINCADO).

### 3. Full pipeline over the 10 format variants  ·  ~€0.1
`data/variants/` has only had **ingestion** tested. End-to-end is still missing: the output must be
identical to the control despite the format change. This is the proof that an MTO from another
engineering studio works.

### 4. Second blind pass on the gold set  ·  €0
Relabel the 30 lines without looking at `data/gold/gold.jsonl`, save to `pass-2.jsonl`, and measure
self-consistency. This is the **lower bound on the human error rate**, which the brief says nobody
has measured, and it's needed for the KPI argument.

### 5. Timed cold-start rehearsal  ·  €0
`rm -rf node_modules .next data/output/.llm-cache` and from there to a working demo. The brief
explicitly requires this. Record the time.

### 6. The 2-pager  ·  €0  ·  **do not delegate**
Maximum 2 pages, 6 rationed sections. It gets **assembled** from the docs, not written from
scratch: the mapping is in `docs/2-pager/README.md`. Section 4 (target solution) is no longer a
promise, it's `docs/12-system-behind-the-rules.md`.

## The third question for the client: NOT to be spent

One of three was left. The candidate was the unit for unwritten imperial lengths (P-4). **The
already-documented and argued default is applied**, it isn't asked about:

- Metric (`M20x90`): the 90 is millimeters, per the ISO designation. Certain, not policy.
- Imperial (`7/8" X 130`): a plausibility range applied all at once, not row by row. 130 inches is
  3.3 m, which doesn't exist for a 7/8" stud. Whatever the range doesn't separate out **isn't
  resolved incorrectly**: it drops to review with `LENGTH_UNIT_IMPLAUSIBLE`.
- Measured impact: 3 of 210 cells, and with `POLICY_UNITLESS_LENGTH=review` autonomy drops from 50%
  to 40%.

Asking something that's already decided, measured, and bounded spends a slot and signals you can't
decide. Saving the slot for a real blocker is the right answer. If a genuine one shows up during
the work, that's what it's for.

## How to work

**Delegate everything mechanical to Sonnet sub-agents**, to avoid spending the big model:

- Running measurements and dumping the numbers table (tasks 1, 2, 3).
- Writing regression tests from an already-diagnosed failure.
- Relabeling the gold set's second pass (task 4) — with the explicit instruction **not to open**
  `gold.jsonl`.
- The cold-start rehearsal (task 5).

**Don't delegate**: interpreting a result that contradicts a prior conclusion, deciding whether the
critic stays, and the 2-pager. That's where judgment is the deliverable.

**Commits**: conventional commits, messages in English, granular and in dependency order. The body
explains the **why** and, where relevant, the error that motivated the change. Trailer
`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Verify `npx tsc --noEmit`
and `npm test` before every commit. Normal push to `main`; no force-pushing.

**And a word of caution on method**: the three costliest errors in this project were measuring
just once, comparing measurements taken under different conditions, and using a rate where a count
was needed. Before stating a number, check what you're comparing it against.

---

# Handoff · prompt to continue in another session

Copy from `---` to `---`.

---

I'm continuing a technical AI Engineer case for Sapira: extraction and normalization of fastener
lines from MTOs (engineering Excel files). The repo is on `main`, clean and synced with
`origin/main`. 31 commits, `npx tsc --noEmit` clean, 88/88 tests, 0 vulnerabilities.

**Read first, in this order:** `docs/README.md` (index), `docs/11-benchmarks.md` (all
measurements with their method and limits), `docs/03-policies.md` (the 12 policies, including P-12),
`docs/12-system-behind-the-rules.md`, and `specs/README.md` (contracts, SPEC-011 to SPEC-013).
Don't re-derive any of that: it's measured and argued already.

## Invariants that are NOT broken

Each one cost a real error. They're in the code comments with their reasoning.

1. **Only the measure extrapolates.** Confirmed by the client on 2026-08-22. Not the quality, not
   the finish. A row's finish without attribution goes to review (`FINISH_SCOPE_UNSTATED`), it isn't
   resolved as blank: asserting absence changes the reference being purchased.
2. **The name is decided by the table, not the model.** `findNames` over the literal term wins. This
   was worth 13 points of silent error.
3. **Quality is emitted exactly as written**, never the group representative. `A4-70` is narrower
   than `A4`.
4. **Never convert between quality groups.** `8.8` (G5) is not `8` (G8).
5. **A row never disappears.** 0 elements → `NO_ELEMENTS_EXTRACTED`. A missing line is read
   as "there's nothing to buy here."
6. **Metrics are calculated over CERTAIN cells** of the gold set (190/210). The 20 policy-dependent
   ones are reported separately as sensitivity analysis.
7. **The silent error rate is only meaningful alongside split fidelity.** A model that doesn't split
   sets gets a favored figure because the harness aligns fewer lines.
8. **The cache only covers the model call**, never the normalizer or the validator: flipping a
   `POLICY_*` in the demo has to be visible.
9. **Cost and latency are measured with `LLM_CACHE=off`.** Measuring against the cache measures the cache.
10. **Comparing models requires an identical prompt and identical provider.** I nearly published a
    false conclusion by comparing two different prompts.
11. **Latency needs repetitions.** `gpt-5.5` gave 6.9 · 44.0 · 64.5 s/row in three identical passes.
12. **`app/` already has the queue, unified vocabulary and suggestions in session** (SPEC-008,
    012, 013). Don't redo screens without reading those specs. Eval history is deliberately kept out of the nav.

## Environment

- **OpenAI has no credit.** Everything runs via OpenRouter, which works.
  `LLM_MAIN=openrouter:openai/gpt-oss-120b:0.03:0.17` matches `gpt-5.5` on the gold set and costs 176×
  less on output. The `gpt-5.5` cache is useful only for the gold set and only with the current prompt.
- Node 26 runs native TypeScript: no build step, imports with the `.ts` extension, and **no
  parameter properties, no `enum`, no `namespace`** (strip-only mode).
- Commands: `pnpm run check` · `eval` · `eval -- --ablate=extract` · `sweep` · `gaps` · `cost` ·
  `variants` · `providers:check` · `inspect` · `run` · `vocab` · `finish:vocab` ·
  `suggestions:kpi` · `mto:synthetic`.

## Pending work, by ROI

### 1. Prompt: comma-separated element series  ·  ~€0.05
Row 63 of the synthetic set fails on both good models:
`Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado`.
It lists the elements as a **comma series** and every example in `src/pipeline/prompts.ts` uses a
connector (`with`, `con`, `W/2`, `c/w`). Add the pattern, re-measure gold + synthetic, confirm the
gold set stays at 0% silent error and that the synthetic lines go from 69 to 71.

### 2. The critic: toughen up or remove  ·  ~€0.01
Today: 29% recall, 33% precision, **31.8% queue noise**. Stop criterion already written in
`specs/SPEC-006-critic.md`: toughen the prompt → if precision doesn't exceed **70%**, switch
the `critic` tier's model → if that doesn't work either, **remove it** and document it in `docs/08-not-done.md`.
The 4 false positives all have the same shape: flagging empty fields (the prompt already says an
empty field isn't an error) and confusing finish with material (`ZN` is CINCADO).

### 3. Full pipeline over the 10 format variants  ·  ~€0.1
`data/variants/` only has **ingestion** tested so far. End-to-end is missing: the output must be
identical to the control's despite the format change. It's the proof that an MTO from another firm works.

### 4. Second blind pass of the gold set  ·  €0
Relabel the 30 lines without looking at `data/gold/gold.jsonl`, save to `pass-2.jsonl` and measure
self-consistency. It's the **lower bound of the human error rate**, which the brief says
nobody has measured, and it's needed for the KPI argument.

### 5. Timed cold-start rehearsal  ·  €0
`rm -rf node_modules .next data/output/.llm-cache` and from there to a working demo. The brief
explicitly requires it. Note the time.

### 6. The 2-pager  ·  €0  ·  **do not delegate**
Maximum 2 pages, 6 assessed sections. It's **assembled** from the docs, not written from scratch: the
mapping is in `docs/2-pager/README.md`. Section 4 (target solution) is no longer a promise, it's
`docs/12-system-behind-the-rules.md`.

## The third client question: NOT spent

One of three was left. The candidate was the unit for unwritten imperial lengths (P-4).
**The default that's already documented and argued is applied**, not asked:

- Metric (`M20x90`): the 90 is millimeters by ISO designation. Certain, not policy.
- Imperial (`7/8" X 130`): the plausibility range applied outright, not row by row. 130 inches
  are 3.3 m, which doesn't exist on a 7/8" stud. What the range can't separate **isn't resolved
  incorrectly**: it falls to review with `LENGTH_UNIT_IMPLAUSIBLE`.
- Measured impact: 3 cells out of 210, and with `POLICY_UNITLESS_LENGTH=review` autonomy drops from 50%
  to 40%.

Asking something that's already decided, measured and bounded wastes a slot and signals indecision.
Saving the slot for a real blocker is the right call. If a genuine one shows up during the
work, that's what it's for.

**Closeout (2026-08-23): none came up.** Implementation uncovered P-10, P-11 and a critic that was
being truncated, and all three are closed either by the client's own rules or are bugs of our own. The
slot reaches the session unspent, and that's said out loud: *"I saved one for whatever day 0 didn't
see. I implemented, three things came up, and the client's own rules closed all three."* The
breakdown is in `client-questions/respuestas.md`.

## How to work

**Delegate to Sonnet subagents** everything mechanical, to avoid spending the big model:

- Running measurements and dumping the numbers table (tasks 1, 2, 3).
- Writing regression tests from an already-diagnosed failure.
- Relabeling the gold set's second pass (task 4) — with the explicit instruction **not to open**
  `gold.jsonl`.
- The cold-start rehearsal (task 5).

**Don't delegate**: interpreting a result that contradicts a prior conclusion, deciding whether the
critic stays, and the 2-pager. That's where judgment is the deliverable.

**Commits**: conventional commits, messages in English, granular and in dependency order. The
body explains the **why** and, when relevant, the error that motivated the change. Trailer
`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Verify
`npx tsc --noEmit` and `pnpm test` before each commit. Regular push to `main`; no force-pushing.

**And a methodological warning**: the three most costly mistakes in this project were
measuring once, comparing measurements taken under different conditions, and using a rate where
a count was needed. Before stating a number, check what you're comparing it against.

---

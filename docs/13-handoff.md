# Handoff · prompt to continue in another session

Copy from `---` to `---`.

---

I'm continuing a technical AI Engineer case for Sapira: extraction and normalization of fastening
lines from MTOs (engineering Excel files). The repo is on `main`, clean and synced with
`origin/main`. 31 commits, `npx tsc --noEmit` clean, 88/88 tests, 0 vulnerabilities.

**Read first, in this order:** `docs/README.md` (index), `docs/11-benchmarks.md` (all
measurements with their method and their limits), `docs/03-policies.md` (the 11 policies), and
`docs/12-system-behind-the-rules.md`. Don't re-derive any of that: it's already measured and
argued.

## Invariants that are NOT broken

Each one cost a real error. They're in the code comments with their reasoning.

1. **Only the measure is extrapolated.** Confirmed by the client on 2026-08-22. Not the quality
   grade, not the finish. A row's finish without attribution goes to review
   (`FINISH_SCOPE_UNSTATED`), it is not resolved as blank: asserting the absence changes the part
   number being purchased.
2. **The name is decided by the table, not the model.** `findNames` on the literal term rules.
   This alone was worth 13 points of silent error.
3. **The quality grade is emitted exactly as written**, never the group's representative. `A4-70`
   is narrower than `A4`.
4. **Never convert between quality groups.** `8.8` (G5) is not `8` (G8).
5. **A row never disappears.** 0 elements → `NO_ELEMENTS_EXTRACTED`. A missing line reads as
   "there is nothing to buy here."
6. **Metrics are computed on the CERTAIN cells** of the gold set (190/210). The 20 policy-dependent
   ones are reported separately as sensitivity.
7. **The silent error rate can only be read alongside split fidelity.** A model that doesn't split
   sets gets a favorable number because the harness aligns fewer lines.
8. **The cache covers only the model call**, never the normalizer or the validator: toggling a
   `POLICY_*` in the demo has to be visible.
9. **Cost and latency are measured with `LLM_CACHE=off`.** Measuring against the cache measures
   the cache.
10. **Comparing models requires an identical prompt and identical provider.** I nearly published a
    false conclusion by comparing two different prompts.
11. **Latency needs repetitions.** `gpt-5.5` gave 6.9 · 44.0 · 64.5 s/row across three identical
    runs.
12. **`app/` belongs to another session.** Read, yes; touch, no, without asking.

## Environment

- **OpenAI has no credit.** Everything through OpenRouter, which works.
  `LLM_MAIN=openrouter:openai/gpt-oss-120b:0.03:0.17` matches `gpt-5.5` on the gold set and costs
  176× less on output. The `gpt-5.5` cache is only useful for the gold set and only with the
  current prompt.
- Node 26 runs native TypeScript: no build step, imports with the `.ts` extension, and **no
  parameter properties, no `enum`, no `namespace`** (strip-only mode).
- Commands: `pnpm run check` · `eval` · `sweep` · `gaps` · `cost` · `variants` ·
  `providers:check` · `inspect` · `run`.

## Pending work, by return on effort

### 1. Prompt: comma-separated series of elements  ·  ~$0.05
Row 63 of the synthetic set is missed by both good models:
`Conjunto: tornillo DIN 931 M20x100 8.8, tuerca DIN 934 10, 2 arandelas DIN 125 200HV, zincado`.
It lists the elements as a **comma-separated series**, and every example in
`src/pipeline/prompts.ts` uses a connector (`with`, `con`, `W/2`, `c/w`). Add the pattern, re-measure
gold + synthetic, confirm the gold set stays at 0% silent error and that the synthetic lines go
from 69 to 71.

### 2. The critic: harden or remove  ·  ~$0.01
Today: recall 29%, precision 33%, **31.8% queue noise**. Stop criterion already written in
`specs/SPEC-006-critic.md`: harden the prompt → if precision doesn't clear **70%**, switch the
`critic` level's model → if that also fails, **remove it** and document it in
`docs/08-not-done.md`. The 4 false positives share the same shape: it flags empty fields (the
prompt already says an empty field is not an error) and confuses finish with material (`ZN` is
CINCADO/zinc-plated).

### 3. Full pipeline over the 10 format variants  ·  ~$0.1
`data/variants/` only has **ingestion** tested. End-to-end is missing: the output must be
identical to the control despite the format change. This is the proof that an MTO from another
engineering firm works.

### 4. Second blind pass of the gold set  ·  $0
Relabel the 30 lines without looking at `data/gold/gold.jsonl`, save to `pass-2.jsonl`, and measure
self-consistency. This is the **lower bound of the human error rate**, which the case statement
says no one has ever measured, and it's needed for the KPI argument.

### 5. Timed cold-start trial  ·  $0
`rm -rf node_modules .next data/output/.llm-cache` and from there to a working demo. The case
statement explicitly requires this. Record the time.

### 6. The 2-pager  ·  $0  ·  **do not delegate**
Maximum 2 pages, 6 sections with a word budget. It is **assembled** from the docs, not written from
scratch: the mapping is in `docs/2-pager/README.md`. Section 4 (target solution) is no longer a
promise, it's `docs/12-system-behind-the-rules.md`.

## The third question to the client: NOT spent

One of three remained. The candidate was the unit for unwritten imperial lengths (P-4). **The
default that is already documented and argued is applied**, it is not asked:

- Metric (`M20x90`): the 90 is millimeters by the ISO designation. Certain, not a policy.
- Imperial (`7/8" X 130`): a plausibility range applied wholesale, not row by row. 130 inches is
  3.3 m, which doesn't exist on a 7/8" stud. What the range doesn't separate out **is not resolved
  incorrectly**: it falls to review with `LENGTH_UNIT_IMPLAUSIBLE`.
- Measured impact: 3 cells out of 210, and with `POLICY_UNITLESS_LENGTH=review` autonomy drops
  from 50% to 40%.

Asking something that's already decided, measured, and bounded wastes a slot and signals a lack of
decisiveness. Saving the slot for a real blocker is the right call. If a genuine one shows up
during the work, that's what it's for.

**Closing note (2026-08-23): none showed up.** Implementing surfaced P-10, P-11, and a critic that
was getting truncated, and all three are closed either by the client's own rules or are our own
bugs. The slot arrives unspent at the session, and that's said out loud: *"I kept one in reserve
for whatever day 0 didn't reveal. I implemented, three things came up, and the client's own rules
closed all three."* The breakdown is in `client-questions/respuestas.md`.

## How to work

**Delegate everything mechanical to Sonnet subagents**, to avoid spending the big model:

- Running measurements and dumping the number table (tasks 1, 2, 3).
- Writing regression tests from an already-diagnosed failure.
- Relabeling the second pass of the gold set (task 4) — with the explicit instruction **not to
  open** `gold.jsonl`.
- The cold-start trial (task 5).

**Don't delegate**: interpreting a result that contradicts a prior conclusion, deciding whether the
critic stays, and the 2-pager. There, judgment is the deliverable.

**Commits**: conventional commits, messages in English, granular and in dependency order. The body
explains the **why** and, when applicable, the error that motivated the change. Trailer
`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Verify `npx tsc --noEmit`
and `pnpm test` before each commit. Normal push to `main`; no forcing.

**And a word of caution on method**: the three costliest mistakes in this project were measuring
only once, comparing measurements taken under different conditions, and using a rate where a count
was needed. Before giving a number, check what you're comparing it against.

---

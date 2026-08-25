# Action plan

> Original plan, not an execution log. The actual dedication declared at closeout is **10–20 h**,
> above the 5–10 h reference. The final canonical figures are in `02-kpi.md` and
> `10-benchmarks.md`.

## Guiding principle

Three decisions govern everything else, and all three come **before** writing code:

1. **The gold set is labeled by hand before building the system.** If labeled afterward, it
   labels what the system already does. And since judgment is assessed against a blind set of 12 rows, the
   only transferable asset is the criteria, not the fit.
2. **The LLM only where there's language.** The case explicitly evaluates "whether you know when an
   agent isn't needed." Practical consequence: we have to *measure* what the model contributes
   versus a deterministic baseline and bring that number to the session.
3. **The ambiguities in section 10 become explicit, switchable policy**, not implicit
   behavior. See `03-policies.md`. When someone in the challenge asks "what if the
   finish only reaches the screw," we flip the flag live and show the KPI delta.

## Proposed architecture

Pipeline with an LLM at three points and determinism everywhere else. Detail in `04-architecture.md`.

| # | Component | Agent? | Why |
|---|---|---|---|
| 1 | **Ingestion** | No | Read Excel, detect headers, ignore column names (`MATERIAL` is a documented trap) and concatenate the row's text into a blob. |
| 2 | **Set segmenter** | **Yes (LLM)** | Break down the prose into N elements with the *literal span* that justifies each one and the detected multiplicity. The only genuinely linguistic problem: multiple languages, free ordering, abbreviations. |
| 3 | **Per-element extractor** | **Yes (LLM)** | The 7 attributes **exactly as they appear**, with textual evidence and explicit `null` when they don't appear. The prompt must not allow "the most probable value." |
| 4 | **Normalizer** | No | Tables G1–G14, DIN→ISO (25 entries), finishes, names. Putting a model here is the criteria error they penalize, and on top of that you pay per token. |
| 5 | **Rules engine / validator** | No | Mandatory-field checks, measure extrapolation, coherence checks, units, section 10 policies. Emits `RESUELTA` / `REVISION_MANUAL` with a typed reason. |
| 6 | **Critic** | **Yes (LLM)**, selective | Only over resolved lines with weak evidence. Rereads the original row against the output and **can only downgrade to review, never promote**. Buys protection against expensive errors at bounded cost. |

All three agents have an answer to "what happens to the KPI if you remove it": without #2, the
set explosion collapses and with it ~40% of the output lines; without #3, the deterministic baseline
loses the free-prose rows; without #6, the silent error rate rises, which is the expensive one.

## The front end

Acceptance criterion written in the brief: *if you have to open an Excel side by side, it isn't
right*. That forces four things that aren't "a pretty table": **quantities per element**,
**grouping by family/supplier**, **inline editing of what's under review** and **export
ready for RFQ**. Plus the per-line trace panel (original text with the highlighted span that
justifies each attribute), which is what they're going to ask for in the challenge.

Detail in `specs/SPEC-008-buyer-ui.md`.

And one detail worth double: every buyer correction in the front end is a label. The correction
log **is** the generator of the gold set the client doesn't have today. It's the heart of
`07-target-solution.md`.

## What I'm measuring against

- Hand-label the 15 rows → 30 lines × 8 cells, **before building anything**.
- **Double blind pass**: label, let it rest, relabel, measure self-consistency. That
  gives a lower bound on the human error rate — which is exactly the "not technically your
  problem" issue the case wants to see owned.
- Mark each cell as **CERTAIN** (deducible from the rules) or **POLICY-DEPENDENT**. The
  KPI is reported over the certain ones; the others are reported as sensitivity analysis. A KPI
  that mixes both isn't defensible.
- Extend with 40–60 synthetic rows generated **from the rules, not from the given MTO**, to
  cover the space the blind set is going to explore.

## KPI (skeleton)

Developed in `02-kpi.md`.

- **Primary — silent error rate**: `RESUELTA` lines with ≥1 wrong attribute ÷ resolved. It's
  the one that costs 3–8 weeks. This is where the hard commitment goes.
- **Secondary — useful autonomy**: lines resolved *and* correct ÷ total. It's the one that buys hours.
- **Separate constraint — set-explosion fidelity**: correct number of output lines. A failure
  here isn't a wrong attribute, it's a material nobody's buying; it can't be diluted into an aggregate.
- **Queue noise**: % of reviews the buyer confirms as already correct. It's the metric
  for the "invisible failure."
- Plus what was explicitly requested: **€/row**, **latency/1000 rows**, **breakdown by attribute**.

## Schedule (5 days, 5–10 h)

| Day | Hours | What | Internal deliverable |
|---|---|---|---|
| **0** | 0.5 | Read everything. Select questions with judgment; **2 of 3** were sent and a slot was reserved. | `docs/client-questions/email-001.md` |
| **1** | 2 | Gold set by hand. Policies for the 6 ambiguities. KPI definition. Repo skeleton. | `data/gold/`, `03-policies.md`, `02-kpi.md` |
| **2** | 2.5 | Complete deterministic pipeline + segmenter/extractor + **evaluation harness**. From here on every change is measured. | `pnpm run eval` green |
| **3** | 2 | Front end: queue, trace, editing, export, header metrics. | navigable demo |
| **4** | 2 | Iterate where it fails by looking at the per-attribute breakdown. Critic. Cost and latency measured. No-LLM baseline measured. Cold start. | `05-results.md` |
| **5** | 1.5 | 2-pager. Dry run of the demo from scratch. Trace of 2–3 specific rows for the challenge. Skeptical client responses. **Send 24 h in advance.** | `docs/2-pager/` |

## Plan risks

| Risk | Mitigation |
|---|---|
| The gold set eats up more time than planned | Close it in 1 h with a timer. An honest 15-row gold set with cells marked as ambiguous is better than a rushed 60-row one. |
| The front end eats up day 4 | Freeze front-end scope at the close of day 3. Whatever isn't in, goes to `08-not-done.md`. |
| No answers arrive to the questions | The defaults are already written and switchable. It doesn't block anything. |
| Unknowingly optimizing against the 15 rows | The synthetic rows from day 1 aren't looked at until day 4. They act as our own blind set. |

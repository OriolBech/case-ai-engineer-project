# Action plan

## Guiding principle

Three decisions order everything else, and all three come **before** writing code:

1. **The gold set is labeled by hand before the system is built.** If it's labeled afterward,
   what gets labeled is what the system already does. And since judgment is measured against a
   blind set of 12 new rows, the only transferable asset is the criterion, not the fit.
2. **The LLM only where there's language.** The case explicitly evaluates "whether you know when
   an agent isn't needed." Practical consequence: you have to *measure* what the model adds over
   a deterministic baseline and bring that number to the session.
3. **The ambiguities in section 10 become explicit, switchable policy**, not implicit behavior.
   See `03-policies.md`. When the challenge asks "what if the finish only applies to the bolt,"
   the flag gets flipped live and the KPI delta gets shown.

## Proposed architecture

A pipeline with the LLM at three points and determinism everywhere else. Detail in
`04-architecture.md`.

| # | Component | Agent? | Why |
|---|---|---|---|
| 1 | **Ingestion** | No | Read the Excel file, detect headers, ignore the column names (`MATERIAL` is a documented trap), and concatenate the row's text into a blob. |
| 2 | **Set segmenter** | **Yes (LLM)** | Break down the prose into N elements with the *literal span* that justifies each one and the detected multiplicity. The only genuinely linguistic problem: multiple languages, free ordering, abbreviations. |
| 3 | **Per-element extractor** | **Yes (LLM)** | The 7 attributes **as they appear**, with textual evidence and explicit `null` when absent. The prompt must not allow "the most likely value." |
| 4 | **Normalizer** | No | Tables G1–G14, DIN→ISO (25 entries), finishes, names. Putting a model here is exactly the judgment error the case penalizes, and you'd pay per token on top of it. |
| 5 | **Rules engine / validator** | No | Required fields, size extrapolation, coherence checks, units, section-10 policies. Emits `RESUELTA` / `REVISION_MANUAL` with a typed reason. |
| 6 | **Critic** | **Yes (LLM)**, selective | Only on resolved lines with weak evidence. Rereads the original row against the output and **can only downgrade to review, never promote**. Buys safety against the expensive error at bounded cost. |

All three agents have an answer for "what happens to the KPI if you remove it": without #2, the
set explosion collapses and with it ~40% of the output lines; without #3, the deterministic
baseline loses the free-prose rows; without #6, silent error goes up, which is the expensive one.

## The front end

Acceptance criterion written into the brief: *if you have to open an Excel file alongside it,
it's not good enough*. That forces four things that aren't "a nice table": **quantities per
element**, **grouping by family/vendor**, **inline editing of what's under review**, and
**RFQ-ready export**. Plus a per-line trace panel (original text with the highlighted span that
justifies each attribute), which is what they're going to ask for in the challenge.

Detail in `specs/SPEC-008-buyer-ui.md`.

And one detail worth double: every buyer correction in the front end is a label. The correction
log **is** the gold-set generator the client doesn't have today. It's the heart of
`07-target-solution.md`.

## What I'm measuring against

- Hand-labeling the 15 rows → ~40 lines × 7 attributes, **before building anything**.
- **Double blind pass**: label, let it sit, relabel, measure self-consistency. That gives a
  lower bound on the human error rate — exactly the problem "that isn't technically yours" the
  case wants to see owned.
- Marking each cell as **CERTAIN** (deducible from the rules) or **POLICY-DEPENDENT**. The KPI is
  reported over the certain ones; the others are reported as sensitivity analysis. A KPI that
  mixes both isn't defensible.
- Extending with 40–60 synthetic rows generated **from the rules, not from the given MTO**, to
  cover the space the blind set is going to explore.

## KPI (skeleton)

Developed in `02-kpi.md`.

- **Primary — silent error rate**: `RESUELTA` lines with ≥1 wrong attribute ÷ resolved. This is
  the one that costs 3–8 weeks. This is where the hard commitment goes.
- **Secondary — useful autonomy**: lines resolved *and correct* ÷ total. This is the one that
  buys hours.
- **Separate constraint — split fidelity**: correct number of output lines. A failure here isn't
  a wrong attribute, it's a material nobody buys; it can't be diluted into an aggregate.
- **Queue noise**: % of reviews the buyer confirms as already correct. This is the "invisible
  failure" metric.
- Plus what was explicitly requested: **€/row**, **latency/1,000 rows**, **breakdown by
  attribute**.

## Schedule (5 days, 5–10 h)

| Day | Hours | What | Internal deliverable |
|---|---|---|---|
| **0** | 0.5 | Read everything. **Send the 3 questions today**, not on day 4. | `docs/client-questions/email-001.md` |
| **1** | 2 | Gold set by hand. Policies for the 6 ambiguities. KPI definition. Repo skeleton. | `data/gold/`, `03-policies.md`, `02-kpi.md` |
| **2** | 2.5 | Full deterministic pipeline + segmenter/extractor + **evaluation harness**. From here on, every change gets measured. | `npm run eval` green |
| **3** | 2 | Front end: queue, trace, editing, export, metrics in the header. | navigable demo |
| **4** | 2 | Iterate where it fails by looking at the per-attribute breakdown. Critic. Cost and latency measured. No-LLM baseline measured. Cold start. | `05-results.md` |
| **5** | 1.5 | 2-pager. Dry run of the demo from scratch. Trace of 2–3 concrete rows for the challenge. Answers for a skeptical client. **Send 24 h ahead.** | `docs/2-pager/` |

## Plan risks

| Risk | Mitigation |
|---|---|
| The gold set eats more time than planned | Close it in 1 h with a timer. An honest 15-row gold set with cells marked as ambiguous beats a rushed 60-row one. |
| The front end eats up day 4 | Freeze front-end scope at the close of day 3. Whatever's not there goes to `08-not-done.md`. |
| No answers to the 3 questions arrive | The defaults are already written and switchable. Not a blocker. |
| Unknowingly optimizing against the 15 rows | The day-1 synthetic rows aren't looked at until day 4. They act as our own blind set. |

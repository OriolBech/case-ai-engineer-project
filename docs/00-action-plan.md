# Action plan

## Guiding principle

Three decisions order everything else, and all three come **before** writing any code:

1. **The gold set is hand-labeled before building the system.** If it's labeled afterward, what
   gets labeled is whatever the system already does. And since judgment is measured against a
   blind set of 12 rows, the only transferable asset is the criterion, not the fit.
2. **The LLM only where there's language.** The case explicitly evaluates "whether you know when
   an agent isn't needed." Practical consequence: you have to *measure* what the model adds over a
   deterministic baseline and bring that number to the session.
3. **The ambiguities in section 10 become explicit, toggleable policy**, not implicit behavior.
   See `03-policies.md`. When they ask in the challenge "what if the finish only applies to the
   bolt," the flag gets flipped live and the KPI delta is shown.

## Proposed architecture

Pipeline with an LLM at three points and determinism everywhere else. Details in
`04-architecture.md`.

| # | Component | Agent? | Why |
|---|---|---|---|
| 1 | **Ingestion** | No | Read the Excel, detect headers, ignore column names (`MATERIAL` is a documented trap) and concatenate the row's text into a blob. |
| 2 | **Set segmenter** | **Yes (LLM)** | Break the prose down into N elements with the *literal span* that justifies each one and the detected multiplicity. The only genuinely linguistic problem: multilingual, free order, abbreviations. |
| 3 | **Per-element extractor** | **Yes (LLM)** | The 7 attributes **exactly as they appear**, with textual evidence and an explicit `null` when they don't appear. The prompt must not allow "the most likely value." |
| 4 | **Normalizer** | No | G1–G14 tables, DIN→ISO (25 entries), finishes, names. Putting a model here is the judgment error the case penalizes, and on top of that you'd pay per token. |
| 5 | **Rules engine / validator** | No | Requirements, size extrapolation, coherence checks, units, section-10 policies. Emits `RESUELTA` / `REVISION_MANUAL` with a typed reason. |
| 6 | **Critic** | **Yes (LLM)**, selective | Only on resolved lines with weak evidence. Re-reads the original row against the output and **can only downgrade to review, never promote**. Buys safety against the costly error at bounded cost. |

All three agents have an answer to "what happens to the KPI if you remove it": without #2, the set
explosion collapses and with it ~40% of the output lines; without #3, the deterministic baseline
loses the free-prose rows; without #6, silent error goes up, which is the costly one.

## The front end

Acceptance criterion stated in the brief: *if you have to open an Excel alongside it, it isn't
good enough*. That requires four things that aren't "a pretty table": **quantities per element**,
**grouping by family/supplier**, **inline editing of what's under review**, and **RFQ-ready
export**. Plus the per-line trace panel (original text with the highlighted span that justifies
each attribute), which is what they're going to ask for in the challenge.

Details in `specs/SPEC-008-buyer-ui.md`.

And one detail worth double: every correction the buyer makes in the front end is a label. The
correction log **is** the generator of the gold set the client doesn't have today. It's the heart
of `07-target-solution.md`.

## What I measure against

- Hand-label the 15 rows → ~40 lines × 7 attributes, **before building anything**.
- **Double blind pass**: label, let it sit, re-label, measure self-consistency. That gives a lower
  bound on the human error rate — which is exactly the "not technically yours" problem the case
  wants to see owned.
- Mark each cell as **CERTAIN** (derivable from the rules) or **POLICY-DEPENDENT**. The KPI is
  reported over the certain ones; the others are reported as sensitivity analysis. A KPI that mixes
  the two isn't defensible.
- Extend with 40–60 synthetic rows generated **from the rules, not from the given MTO**, to cover
  the space the blind set is going to explore.

## KPI (skeleton)

Developed in `02-kpi.md`.

- **Primary — silent error rate**: `RESUELTA` lines with ≥1 wrong attribute ÷ resolved. It's the
  one that costs 3–8 weeks. This is where the hard commitment goes.
- **Secondary — useful autonomy**: lines resolved *and correct* ÷ total. It's the one that buys
  hours.
- **Separate constraint — explosion fidelity**: correct number of output lines. A failure here
  isn't a wrong attribute, it's a material nobody buys; it can't be diluted into an aggregate.
- **Queue noise**: % of reviews the buyer confirms were already correct. It's the "invisible
  failure" metric.
- Plus what's explicitly requested: **€/row**, **latency/1000 rows**, **breakdown by attribute**.

## Schedule (5 days, 5–10 h)

| Day | Hours | What | Internal deliverable |
|---|---|---|---|
| **0** | 0.5 | Read everything. **Send the 3 questions today**, not on day 4. | `docs/client-questions/email-001.md` |
| **1** | 2 | Hand-made gold set. Policies for the 6 ambiguities. KPI definition. Repo skeleton. | `data/gold/`, `03-policies.md`, `02-kpi.md` |
| **2** | 2.5 | Full deterministic pipeline + segmenter/extractor + **evaluation harness**. From here on, every change is measured. | `pnpm run eval` green |
| **3** | 2 | Front end: queue, trace, editing, export, header metrics. | navigable demo |
| **4** | 2 | Iterate where it fails by looking at the attribute breakdown. Critic. Cost and latency measured. No-LLM baseline measured. Cold start. | `05-results.md` |
| **5** | 1.5 | 2-pager. Demo rehearsal from scratch. Trace for 2–3 specific rows for the challenge. Answers for a skeptical client. **Send 24 h ahead.** | `docs/2-pager/` |

## Risks of the plan

| Risk | Mitigation |
|---|---|
| The gold set eats more time than planned | Close it in 1 h with a timer. A 15-row gold set that's honest and has cells flagged as ambiguous beats a 60-row one done in a rush. |
| The front end eats up day 4 | Freeze the front end's scope at the close of day 3. Whatever isn't there goes to `08-not-done.md`. |
| The answers to the 3 questions don't arrive | The defaults are already written and toggleable. It doesn't block. |
| Optimizing against the 15 rows without noticing | The synthetic rows from day 1 aren't looked at until day 4. They function as my own blind set. |

# Specs

One spec per component. Describes **what it must do**, not how it's implemented. If the code and
the spec disagree, one of the two is a bug: fix whichever is wrong, in the same commit.

The reasoning and the decisions **don't** go here, they go in `docs/`. Here, only the contract.

## Index

| Spec | Component | Stage | LLM | Status |
|---|---|---|---|---|
| [SPEC-001](SPEC-001-ingest.md) | `src/pipeline/ingest.ts` | 1 · Ingestion | No | ✅ |
| [SPEC-002](SPEC-002-set-splitter.md) | `src/pipeline/analyze.ts` | 2 · Set segmentation | **Yes** | ✅ |
| [SPEC-003](SPEC-003-attribute-extractor.md) | `src/pipeline/analyze.ts` · `src/pipeline/baseline.ts` | 3 · Attribute extraction | **Yes** (baseline: no) | ✅ |
| [SPEC-004](SPEC-004-normalizer.md) | `src/rules/` | 4 · Normalization | No | ✅ |
| [SPEC-005](SPEC-005-validator.md) | `src/pipeline/validate.ts` | 5 · Rules and resolution | No | ✅ |
| [SPEC-006](SPEC-006-critic.md) | `src/pipeline/critic.ts` | 6 · Critic | **Yes** | ✅ |
| [SPEC-007](SPEC-007-confidence.md) | `src/lib/confidence.ts` | Cross-cutting · Confidence and threshold | No | ✅ |
| [SPEC-008](SPEC-008-buyer-ui.md) | `app/` | Buyer front end | No | ✅ |
| [SPEC-009](SPEC-009-eval-harness.md) | `src/eval/` | Evaluation | No | ✅ |
| [SPEC-010](SPEC-010-evaluation-history.md) | `src/eval/history/` | History, corrections and suggestions | No | ✅ |
| [SPEC-011](SPEC-011-finish-vocabulary.md) | `src/rules/finish-db.ts` | 4 · Finish vocabulary | No | ✅ |
| [SPEC-012](SPEC-012-unified-vocabulary.md) | `src/rules/vocab.ts`, `app/components/VocabularyView.tsx` | Front end · unified vocabulary view | No | ✅ |
| [SPEC-013](SPEC-013-suggestions.md) | `src/eval/history/suggestions.ts` | Vocabulary suggestions and their KPI | No | 🚧 |
| [SPEC-014](SPEC-014-revisions.md) | `src/domain/identity.ts`, `revision-diff.ts` | Line identity and diff between revisions | **No** | ✅ kernel · 🚧 UI |
| [SPEC-015](SPEC-015-corrections-learning.md) | `src/eval/history/corrections.ts` · `src/domain/ports.ts` | Supervised learning from corrections | **No** | 📋 contract |
| [SPEC-016](SPEC-016-kpi-dashboard.md) | `src/kpi/` · `app/components/KpiDashboardScreen.tsx` | Buyer KPI dashboard | No | ✅ |
| [SPEC-017](SPEC-017-quality-vocabulary.md) | `src/rules/quality-db.ts` | 4 · Quality vocabulary (layer 2 of §5) | No | ✅ |

New template: copy [`_template.md`](_template.md).

## Golden rule of the project

Every spec for a component with an LLM must answer, in its *Why an LLM* section, the question
**"what does a table do worse here?"**. If there's no answer, the component shouldn't have an
LLM (an explicit evaluation criterion of the case).

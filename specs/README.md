# Specs

One spec per component. Describes **what it must do**, not how it's implemented. If the code and
the spec disagree, one of the two is a bug: fix whichever is wrong, in the same commit.

The reasoning and the decisions **don't** go here, they go in `docs/`. Here, only the contract.

## Index

| Spec | Component | Stage | LLM | Status |
|---|---|---|---|---|
| [SPEC-001](SPEC-001-ingest.md) | `src/pipeline/ingest.ts` | 1 · Ingestion | No | 🚧 |
| [SPEC-002](SPEC-002-set-splitter.md) | `src/pipeline/split.ts` | 2 · Set segmentation | **Yes** | 🚧 |
| [SPEC-003](SPEC-003-attribute-extractor.md) | `src/pipeline/extract.ts` | 3 · Attribute extraction | **Yes** | 🚧 |
| [SPEC-004](SPEC-004-normalizer.md) | `src/rules/` | 4 · Normalization | No | ✅ |
| [SPEC-005](SPEC-005-validator.md) | `src/pipeline/validate.ts` | 5 · Rules and resolution | No | 🚧 |
| [SPEC-006](SPEC-006-critic.md) | `src/pipeline/critic.ts` | 6 · Critic | **Yes** | 🚧 |
| [SPEC-007](SPEC-007-confidence.md) | `src/lib/confidence.ts` | Cross-cutting · Confidence and threshold | No | 🚧 |
| [SPEC-008](SPEC-008-buyer-ui.md) | `app/` | Buyer front end | No | 🚧 |
| [SPEC-009](SPEC-009-eval-harness.md) | `src/eval/` | Evaluation | No | 🚧 |

New template: copy [`_template.md`](_template.md).

## Golden rule of the project

Every spec for a component with an LLM must answer, in its *Why an LLM* section, the question
**"what does a table do worse here?"**. If there's no answer, the component shouldn't have an
LLM (an explicit evaluation criterion of the case).

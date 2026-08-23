# SPEC-010 · Evaluation history and supervised learning

| | |
|---|---|
| **Files** | `src/eval/history/`, `data/eval/history.sqlite` |
| **Stage** | Evaluation and continuous improvement |
| **LLM** | No |
| **Status** | 🚧 draft |
| **Related specs** | `SPEC-004`, `SPEC-008`, `SPEC-009` |
| **Policies applied** | None: it records the effective policies of each run |

## Purpose

Preserve every evaluation as reproducible evidence, compare system versions and convert
approved human corrections into improvement candidates without the system learning from its own
predictions.

This component is not the commercial revision history of a construction site. It records experiments,
results and corrections in order to answer:

- what changed between two runs;
- which metrics improved or worsened;
- which lines explain the change;
- which errors recur;
- which human corrections can extend the vocabulary or the gold set.

## Why not an LLM

Persisting results, computing deltas and applying promotion rules are exact operations. A
model would add variability precisely in the record that must allow auditing the rest of the
system's variability.

An LLM could propose an explanation for a regression in another layer, but it will never write metrics,
approve corrections, or modify vocabulary automatically.

## Contract

### Commands

```bash
pnpm run eval -- --save
pnpm run eval -- --save --label="material-v2"
pnpm run eval:history
pnpm run eval:compare -- <base-run> <candidate-run>
```

- `--save` persists the same report `SPEC-009` produces.
- Without `--save`, `pnpm run eval` keeps its current behavior and doesn't write to SQLite.
- `--label` is optional and only serves to identify a run.
- `eval:history` lists the most recent runs.
- `eval:compare` compares two persisted runs.

### Run input

```ts
interface EvaluationRunInput {
  label: string | null;
  dataset: {
    name: string;
    fingerprint: string;
    rows: number;
    goldLines: number;
  };
  system: {
    gitCommit: string | null;
    dirty: boolean;
    model: string;
    provider: string;
    routing: string;
    criticRouting: string;
    policyFingerprint: string;
    policyOverrides: PolicyOverride[];
    configurationFingerprint: string;
  };
  report: EvalReport;
  cost: {
    eur: number | null;
    pricesConfigured: boolean;
  };
  latencyMs: number;
}
```

### Comparison output

```ts
interface EvaluationComparison {
  baseRunId: string;
  candidateRunId: string;
  comparable: boolean;
  incompatibilities: string[];
  metrics: Array<{
    name: string;
    base: number;
    candidate: number;
    delta: number;
    direction: 'improved' | 'regressed' | 'unchanged';
  }>;
  changedLines: Array<{
    rowRef: string;
    goldId: string | null;
    change: 'fixed' | 'regressed' | 'status_changed' | 'split_changed';
    details: string[];
  }>;
}
```

## Persisted model

SQLite holds four logical entities:

1. **Run**: identity, date, dataset, commit, worktree state, configuration, cost and
   latency.
2. **Metric**: name, value, numerator and denominator of each global or per-attribute KPI.
3. **Line result**: expected, obtained, status, failed cells and reasons, so any delta can be
   explained without re-running the model.
4. **Human correction**: previous value, corrected value, evidence, author, date and review
   status.

The initial migration must create, at minimum:

```sql
CREATE TABLE evaluation_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  label TEXT,
  dataset_name TEXT NOT NULL,
  dataset_fingerprint TEXT NOT NULL,
  git_commit TEXT,
  git_dirty INTEGER NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  routing TEXT NOT NULL,
  critic_routing TEXT NOT NULL,
  policy_fingerprint TEXT NOT NULL,
  policy_overrides_json TEXT NOT NULL,
  configuration_fingerprint TEXT NOT NULL,
  rows INTEGER NOT NULL,
  gold_lines INTEGER NOT NULL,
  system_lines INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  cost_eur REAL,
  prices_configured INTEGER NOT NULL
);

CREATE TABLE evaluation_metrics (
  run_id TEXT NOT NULL REFERENCES evaluation_runs(id),
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  numerator INTEGER,
  denominator INTEGER,
  PRIMARY KEY (run_id, scope, name)
);

CREATE TABLE evaluation_lines (
  run_id TEXT NOT NULL REFERENCES evaluation_runs(id),
  row_ref TEXT NOT NULL,
  gold_id TEXT,
  system_id TEXT,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, row_ref, gold_id, system_id)
);

CREATE TABLE human_corrections (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  run_id TEXT REFERENCES evaluation_runs(id),
  row_ref TEXT NOT NULL,
  line_id TEXT,
  attribute TEXT NOT NULL,
  previous_value TEXT,
  corrected_value TEXT,
  evidence TEXT NOT NULL,
  author TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROMOTED')),
  promoted_entry_id TEXT
);
```

Persisted JSON must be versioned by schema. A future migration can never silently
reinterpret old data.

## Behavior

1. Every saved run receives an immutable, transactional identifier.
2. The dataset fingerprint includes the input and the gold set. Changing either creates a different
   dataset, even if it keeps the same name.
3. The configuration fingerprint includes models, prompts, thresholds, policies and versions of the
   deterministic tables that can change the output.
4. A run with a dirty worktree is still saved, but marked as such. It's not solely attributed to
   the commit.
5. Numerator and denominator are persisted along with the percentage. A `100% [2/2]` isn't equivalent to
   `100% [200/200]`.
6. The main comparison is only valid when both runs use the same dataset fingerprint.
7. If gold set, policies, certainty criteria or out-of-scope population change, the comparison is
   marked as not comparable and lists the differences. It can still show the numbers, but can't declare
   improvement or regression.
8. Each metric's direction is declared: lower is better for silent error, noise and cost;
   higher is better for autonomy, split fidelity and agreement.
9. A comparison always includes the lines responsible for the delta. An aggregate without examples
   isn't sufficient.
10. Saving a run never modifies the gold set, vocabulary, policies or previous results.
11. A human correction can only be recorded over literal evidence from the original row.
12. A system prediction never becomes a correction on its own. Re-running the same prediction
   many times doesn't increase its authority either.
13. Only `APPROVED` corrections can be promoted. Promotion is an explicit, separate action.
14. Promoting a correction creates an auditable entry in the corresponding vocabulary or a
   proposal to modify the gold set. It doesn't directly modify code or historical results.
15. After a promotion, the system must run the regression battery before marking it
   `PROMOTED`. If a regression appears, the correction remains `APPROVED`.
16. Historical results are append-only. Labels can be edited; evidence cannot.
17. A failed run can be recorded as such in a future extension, but it can't
   be presented as a complete evaluation nor enter KPI comparisons.

## Minimum comparison

The report between two runs must show:

| Group | Data |
|---|---|
| Context | date, label, commit, dirty, dataset, model, policies |
| Main KPI | silent error and useful autonomy, with numerators and denominators |
| Safety | split fidelity, quantity, out-of-family and critic failures |
| Operation | cost, latency and calls |
| Diagnostics | corrected lines, regressions, status changes and split changes |

An improvement is rejected if it increases silent error, even if it improves autonomy, unless it's
explicitly presented as an alternative position on the risk/coverage curve and not as the new default.

## Supervised learning

The allowed loop is:

```text
run -> human review -> pending correction -> approval
    -> vocabulary/gold candidate -> regression -> promotion
```

Not allowed:

```text
run -> copy prediction into vocabulary -> next run
```

The first flow learns from the buyer. The second learns from itself and amplifies errors.

The first implementation can limit corrections to `material`, because a versioned
vocabulary already exists for that attribute. The contract keeps `attribute` open to extend it
later to name, quality, standard and finish. Measure and length aren't promoted as
vocabulary: they're grammar.

## Edge cases

| Case | Expected behavior |
|---|---|
| Same commit, different configuration | Two distinct runs; the configuration appears in the diff |
| Same nominal dataset, modified gold set | Not comparable by fingerprint |
| Run with a dirty worktree | Saved with `dirty=true` |
| Prices not configured | `cost_eur=null`; never presented as zero cost |
| Line disappeared | `split_changed`, not a hit due to absence |
| Wrong quantity | Regression and possible silent error |
| Correction without literal evidence | Rejected |
| Approved correction that breaks tests | Not promoted |
| Contradictory human corrections | Remain pending until explicit resolution |
| New or empty database | Automatic migration and empty history |
| Interrupted write | No partial run visible; transaction rolled back |

## Acceptance criteria

- [ ] `pnpm run eval -- --save` adds exactly one complete run.
- [ ] Repeating it doesn't overwrite the previous one.
- [ ] Each KPI is preserved with value, numerator and denominator.
- [ ] Quantity is part of the per-line results and of the silent error metric.
- [ ] `eval:compare` detects incompatible datasets or policies.
- [ ] `eval:compare` lists the lines that explain each regression.
- [ ] An unknown cost is saved as `null`, never as `0`.
- [ ] A failure during writing leaves no partial runs.
- [ ] No run modifies vocabulary or gold set.
- [ ] An unapproved correction cannot be promoted.
- [ ] A promotion requires passing the regression battery.
- [ ] The database can be rebuilt or migrated without losing the interpretation of previous runs.
- [ ] Tests with a temporary SQLite database cover persistence, rollback, comparison and promotion.

## Out of scope for the first implementation

- Commercial revision history of a construction site.
- Real order status, receipts or cancellations.
- Machine learning or fine-tuning.
- Automatic promotion based on frequency or model consensus.
- Full temporal dashboard; the first interface can be a CLI.
- Storing the complete original Excel file. Fingerprints, results and the minimum necessary
  evidence are stored, avoiding duplicating client data unnecessarily.

## What happens to the KPI if this is removed

A single run's KPI can still be calculated, but it can't be demonstrated that a modification
improves the system, nor can historical regressions be detected. The controlled path for
turning real corrections into additional coverage is also lost. Without this component, "we're learning" is
a claim; with it, it's an auditable time series.

# SPEC-011 · Finish vocabulary

| | |
|---|---|
| **Files** | `src/rules/finish-db.ts`, `src/rules/finish.ts` (adapters), `data/vocabulary/finish-alias.json`, `data/vocabulary/finish-alias.log.jsonl` |
| **Stage** | 4 · Normalization (table) · learning loop |
| **LLM** | No |
| **Status** | ✅ implemented |
| **Related specs** | `SPEC-004` · `SPEC-005` (P-12) · `SPEC-008` · `SPEC-010` · `SPEC-012` (unified facade) |
| **Policies it applies** | `P-1` (finish scope) · **P-12** (unrecognized finish) |

## Purpose

That the finish catalog is **data, not code**, so a finish the system doesn't know can be closed
out by the buyer without a deployment — and so the system refuses to resolve a line whose finish
it doesn't understand, instead of resolving it as if it had none.

It closes the asymmetry left open by gap detection (`UNKNOWN_VALUE` on `finish`,
`src/pipeline/coverage.ts`): the system already knew how to say *"I don't recognize
`tropicalizado`"* and nobody who didn't touch TypeScript could answer it.

## Why not an LLM

Deciding that `tropicalizado` is `CINCADO` is a domain judgment backed by a source (a standard,
the client's spec, a call to the vendor). A model would *guess* it, and §9 says that an element
with a finish and the same one without a finish are **different references**: an invented
equivalence isn't a poorly normalized datum, it's the wrong reference bought with a machine's
confidence.

An LLM can indeed **propose** the candidate. It cannot approve it, and the proposal doesn't enter
the table without a human's signature.

## Contract

### The three outcomes for an unrecognized finish

| Outcome | What it asserts | Who decides | Effect |
|---|---|---|---|
| `alias` | "this is a way of writing one of the 7" | **buyer** | the line resolves with the catalog value |
| `not_a_finish` | "this isn't a finish" (`según pliego`, `pintado`) | **buyer** | declared absence: produces no gap and doesn't block |
| new catalog entry (an 8th finish) | "the §9 catalog is incomplete" | **escalation, NOT self-service** | see *Out of scope* |

### Input · a vocabulary entry

```ts
export type FinishAliasKind = 'alias' | 'not_a_finish';

export interface NewFinishAlias {
  id: string;
  alias: string;
  kind: FinishAliasKind;
  finish: Finish | null;       // one of the 7 when kind='alias'; null when kind='not_a_finish'
  source: AliasSource;         // 'client' | 'added'
  rationale: string;
  decidedBy: string;
  evidence: string;            // standard, spec, or contact. Never "just because"
}
```

### Output · the read side

```ts
export function resolveFinish(rawOrText: string): FinishResolution;

export type FinishResolution =
  | { kind: 'known'; finish: Finish; entryId: string; rule: string; alias: string; aliasSource: AliasSource }
  | { kind: 'not_a_finish'; why: string; entryId: string }
  | { kind: 'unknown' }
  | { kind: 'ambiguous'; candidates: { entryId: string; finish: Finish | null; alias: string }[] };
```

`src/rules/finish.ts` keeps `findFinishes` / `normalizeFinish` as adapters for the pipeline. The
table lives here.

### Invariants

- The **log is the source of truth** and lives in git (`data/vocabulary/finish-alias.log.jsonl`);
  SQLite is a materialized view that gets rebuilt entirely from the seed + the log on every open.
- The 7 `Finish` values **aren't** touched from here. This component decides which *texts* map to
  each of the 7, not what the 7 are.
- An entry isn't deleted: it's retired (`retireEntry`) with its reason, and it keeps explaining
  what was bought under it.
- No read ever writes. Detecting an unknown finish doesn't add it.
- The id is the trace of a purchase: it's never reused, even if the entry is retired. The facade
  (`SPEC-012`) mints a new id if the same alias is re-added.

## Behavior

1. `resolveFinish` matches by **word boundary, longest first**. `ZINC PLATED` beats `ZINC`.
2. An uncovered finish returns `unknown`, produces the `UNKNOWN_VALUE` gap, and applies **P-12**.
3. **P-12 · `POLICY_UNKNOWN_FINISH`**, values `review | resolve`:
   - `review` (**default**) — the line goes to review with reason `UNMAPPED_VALUE`. The gap still
     goes to the backlog, a single entry even if the alias appears in 40 rows.
   - `resolve` — KPI-published ablation: the line resolves as if it carried no finish; the gap
     stays only in the backlog.
   - The 15-row gold set **carries no unknown finishes**, so the `review` default doesn't move
     the published figures. The delta shows up in the synthetic MTO
     (`pnpm run mto:synthetic`).
4. Ambiguity **is reported, not resolved** (`kind: 'ambiguous'` → also `UNMAPPED_VALUE`).
5. `not_a_finish` is a **declared absence**: no gap, no review, no P-12.
6. An entry from the front end and one from the CLI (`pnpm run finish:vocab`) write to the same
   log.
7. `retiredAt` stops it from being derived without deleting the entry.

### Guards · what gets rejected before writing

Hard invariants (always reject, even with `force`):

1. **Duplicate id** → rejected.
2. **Alias without a finish** when `kind='alias'` → rejected.

Policy guards (with `force: true`, the demo API default, they still get saved and travel as
`warnings`; with `force: false` they reject):

3. **Ambiguity** — an `alias` that already maps to another finish.
4. **Non-regression of the table itself** — for every live alias, `resolveFinish(A)` must be the
   same before and after.
5. **Short alias** (< 3 characters) — requires explicit `allowShortAlias`.
6. **Gold battery** — an addition that changes a gold-set line. Reuses the mechanism from
   `SPEC-010`.

## Relationship with SPEC-010 and SPEC-012

- `human_corrections.attribute` accepts `'finish'`. `promoteCorrection` writes to `finish-db.ts`.
- The front end **doesn't** talk to this module: it talks to the `src/rules/vocab.ts` facade
  (`SPEC-012`).
- Finish suggestions (`SPEC-013`) are the cheap path from gap to entry; they don't replace this
  contract.

## Edge cases

| Case | Expected behavior |
|---|---|
| `tropicalizado` (unknown) | `UNKNOWN_VALUE` gap + P-12 → `UNMAPPED_VALUE`; entry from `/vocabulario?attr=finish&alias=tropicalizado` |
| `GEOMET-500B` | resolves as `GEOMET`; neither a gap nor an entry |
| `zincado` not attributed to an element (P-1) | `FINISH_SCOPE_UNSTATED`, **not** a gap |
| Row with no finish | valid absence per §9. No gap, no review, no P-12 |
| `según pliego cliente` | `not_a_finish` candidate |
| Adding `ZINC` while `ZINC PLATED` exists | guard 4: warning (demo) or rejection (`force: false`) |
| Adding `ZN → BICROMATADO` while `ZN → CINCADO` exists | guard 3 |
| A real 8th finish | recognized and **escalated**; not added via self-service |
| Deleted database | rebuilt entirely from seed + log |

## Acceptance criteria

- [x] The migration is a no-op on the gold set: the 15 rows of the given MTO don't change status
      by moving the catalog to SQLite (they carry no unknown finishes).
- [x] The 7 `Finish` values and the current aliases end up in the seed, with their `AliasSource`.
- [x] `pnpm run rules:audit` still shows the provenance of each alias (client vs. added).
- [x] An unknown finish produces a gap with the literal value, and a single backlog entry even if
      it appears across several rows.
- [x] With `POLICY_UNKNOWN_FINISH=review` the line comes out with `UNMAPPED_VALUE`; with
      `resolve`, it doesn't.
- [x] The guards have tests (`src/rules/__tests__/finish-db.test.ts`).
- [x] An entry from the front end and one from the CLI produce the same log line.
- [x] The database rebuilds from scratch and derives the same way.
- [x] An unapproved `finish` correction isn't promoted; an approved one that breaks the gold set
      isn't either.
- [x] The existing `finish` tests still pass via the `finish.ts` adapters.

## Out of scope

- **Extending the §9 catalog to an 8th finish.** Changes the `Finish` type, the gold set, and
  historical comparability. This component **detects it and escalates it**.
- Name, quality, and standard as editable data. Same pattern; today they're exposed read-only
  (`SPEC-012`). Finish came first because it was the only one failing silently.
- An LLM proposing the equivalence. Compatible with this contract, and a separate piece
  (`SPEC-013` bounds the source: closed table or row evidence, never a free-form call).

## What happens to the KPI if this is removed

Silent error keeps open a hole no metric sees: an unknown finish comes out as "no finish," which
§9 declares valid, so it **doesn't count as a failure**. The KPI keeps being calculated and stays
blind to this class. P-12 in `review` turns that invisible failure into a review; without this
component, the silence comes back.

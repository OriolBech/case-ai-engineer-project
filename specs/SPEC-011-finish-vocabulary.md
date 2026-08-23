# SPEC-011 · Finish vocabulary

| | |
|---|---|
| **Files** | `src/rules/finish-db.ts`, `data/vocabulary/finish-alias.json`, `data/vocabulary/finish-alias.log.jsonl` |
| **Stage** | 4 · Normalization (table) · learning loop |
| **LLM** | No |
| **Status** | 🚧 draft — not implemented |
| **Related specs** | `SPEC-004` (normalizer), `SPEC-005` (validator), `SPEC-009`, `SPEC-010` (human corrections) |
| **Policies it applies** | `P-1` (finish scope, already existing) · **P-12** (unrecognized finish), new |

## Purpose

To make the finish catalog **data, not code**, so that a finish the system doesn't know can be
closed out by the buyer without a deployment — and so the system can refuse to resolve a line
whose finish it doesn't understand, instead of resolving it as if it had none.

This closes the asymmetry left open by the gap detection (`UNKNOWN_VALUE` on `finish`,
`src/pipeline/coverage.ts`): today the system **already knows how to say** *"I don't recognize
`tropicalizado`"*, and no one who doesn't touch TypeScript can answer it. See
`docs/12-system-behind-the-rules.md` §4, "Rules as data, not as code".

## Why not an LLM

Deciding that `tropicalizado` is `CINCADO` is a domain judgment backed by a source (a standard,
the client's spec sheet, a call to the supplier). A model would *guess* it, and §9 says an element
with a finish and the same one without a finish are **different references**: an invented
equivalence isn't a badly normalized data point, it's the wrong reference bought with a machine's
confidence.

This is exactly the argument `SPEC-004` makes for the rest of the tables, with the aggravating
factor that here the error is invisible: a mis-equated finish comes out RESOLVED and looking
perfect.

An LLM *can* **propose** the candidate (search `tropicalizado` in the spec sheet and suggest what
it maps to). It cannot approve it, and the proposal doesn't enter the table without a human's
signature.

## Contract

### The three outcomes for an unrecognized finish

The decision this component exists to capture. A finish the table doesn't know can be
**three distinct things**, and only two of them can be decided by the buyer:

| Outcome | What it asserts | Who decides | Effect |
|---|---|---|---|
| `alias` | "this is a way of writing one of the 7" | **buyer** | the line resolves with the catalog value |
| `not_a_finish` | "this is not a finish" (`according to spec sheet`, `painted`) | **buyer** | declared absence: produces no gap and doesn't block |
| new catalog entry (an 8th finish) | "the §9 catalog is incomplete" | **escalation, NOT self-service** | see *Out of scope* |

An 8th finish is not a vocabulary entry: it changes the closed catalog the client provided, changes
the `Finish` type, invalidates the gold set, and breaks comparability of every previous KPI. The
system must **recognize** the case and refuse to resolve it via self-service, not offer it as just
another option.

### Input · a vocabulary entry

```ts
export type FinishAliasKind = 'alias' | 'not_a_finish';

export interface NewFinishAlias {
  id: string;
  /** The text as it appears in the MTO. Matched on word boundary, never as a substring. */
  alias: string;
  kind: FinishAliasKind;
  /** One of the 7 from §9 when kind='alias'; null when kind='not_a_finish'. */
  finish: Finish | null;
  /** Kept from `AliasSource`: whether it came in the client's table or we added it. */
  source: AliasSource;
  rationale: string;
  decidedBy: string;
  /** Standard, spec sheet page, or point of contact. Never "just because". */
  evidence: string;
}
```

### Output · the read

```ts
/** Replaces `normalizeFinish`/`findFinishes` from `src/rules/finish.ts`. */
export function resolveFinish(rawOrText: string): FinishResolution;

export type FinishResolution =
  | { kind: 'known'; finish: Finish; entryId: string; rule: string }
  /** Deliberately declared not-a-finish, with its reason. It is NOT a gap. */
  | { kind: 'not_a_finish'; why: string; entryId: string }
  /** No entry covers it: policy gap + P-12. */
  | { kind: 'unknown' }
  /** Two live entries cover it with different finishes. The table owes a disambiguation. */
  | { kind: 'ambiguous'; candidates: { entryId: string; finish: Finish }[] };
```

### Invariants

- The **log is the source of truth** and lives in git; the SQLite database is a materialized view
  that gets rebuilt entirely from the seed + the log every time it's opened. Identical to
  `src/rules/vocabulary-db.ts`.
- The 7 `Finish` values are **not** touched from here. This component decides which *texts* map to
  each of the 7, not which the 7 are.
- An entry is never deleted: it's retired with its reason, and keeps explaining what was bought
  under it.
- No read writes. Detecting an unknown finish doesn't register it.

## Behavior

1. `resolveFinish` matches on **word boundary, longest first**, same as today: `ZINC PLATED`
   beats `ZINC`. The migration cannot change a single result of the current catalog (see
   criterion 1).
2. A finish with no coverage returns `unknown`, produces the `UNKNOWN_VALUE` gap that already
   exists, and applies **P-12**.
3. **P-12 · `POLICY_UNKNOWN_FINISH`**, values `review | resolve`:
   - `review` — the line goes to review with reason `UNMAPPED_VALUE` (a code already declared in
     `src/pipeline/types.ts` and today **never emitted**; this spec claims it).
   - `resolve` — current behavior: the line resolves as if it had no finish, and the gap stays
     only in the backlog.
   - **Proposed default: `review`**, and the proposal carries its own acceptance condition: it's
     a behavior change on the published KPI, so it's decided with the measured delta
     (`SPEC-009`), not with this paragraph. The project's bias is to surface the costly failure,
     and §9 makes a wrong finish a wrong reference; but it costs autonomy on every new finish, and
     that has to be seen before it's fixed.
4. Ambiguity **is reported, not resolved** — same decision and same reasoning as
   `deriveMaterial`: picking the first match is a default firing silently.
5. `not_a_finish` is a **declared absence**: neither gap, nor review, nor P-12. It's distinguished
   from `unknown` in that someone already decided it, same as `deliberatelyUncovered` in material.
6. An entry added from the front end is indistinguishable from one added via CLI: both write to
   the same log.
7. `retiredAt` retires an entry without deleting it.

### Guards · what gets rejected before writing

The riskiest part of the component. A badly placed finish entry doesn't break today's line:
**it silently changes lines that come out right today.**

1. **Duplicate id** → rejection. The id is the audit trail of a purchase.
2. **Ambiguity** → rejection. An `alias` that already maps to a different finish would turn all
   its previously resolved lines into review without anyone asking for it. Same text and same
   message as `addEntry` in material.
3. **Non-regression of the table itself** → rejection. For **every** live alias `A`, the result of
   `resolveFinish(A)` must be the same before and after adding the entry. This is the guard that
   catches the `ZINC` vs `ZINC PLATED` class: a new alias that slips in under another and changes
   its reading.
4. **Short alias** → rejected unless explicitly confirmed. Under 3 characters is the highest-risk
   case and is documented in the current code (`src/rules/finish.ts`: `ZN`, `ZP`, `BL` come from
   the client and are matched on word boundary precisely so that any random `BL` doesn't turn into
   `PAVONADO`). Adding a 1–2 character entry requires a deliberate flag, not an oversight.
5. **Regression suite** → an addition that changes any line in the gold set is not promoted.
   Reuses the mechanism from `SPEC-010` §"Supervised learning", doesn't invent another one.

### Relationship with SPEC-010

This component does **not** define its own corrections loop. SPEC-010 already has one
(`proposal → approval → regression → promotion`) and today limits it to `material` as the only
attribute with a versioned vocabulary. This spec is the second one:

- `human_corrections.attribute` accepts `'finish'`.
- `promoteCorrection` stops rejecting `finish` and writes to `finish-db.ts`.
- SPEC-010's rule stays intact: only `APPROVED` gets promoted, and a regression leaves the
  correction as `APPROVED`, without promoting it.

## Edge cases

| Case | Expected behavior |
|---|---|
| `tropicalizado` (unknown) | `UNKNOWN_VALUE` gap + P-12; addition possible from the front end |
| `GEOMET-500B` (variant of one of the 7) | resolves as `GEOMET`; **not** a gap or an addition |
| `zincado` not attributed to an element (P-1) | `FINISH_SCOPE_UNSTATED`, **not** a gap: it's attribution, not recognition |
| Row with no finish | valid absence per §9. Neither gap, nor review, nor P-12 |
| `según pliego cliente` | candidate for `not_a_finish` |
| Adding `ZINC` when `ZINC PLATED` already exists | rejected by guard 3 if it changes its reading |
| Adding `ZN → BICROMATADO` when `ZN → CINCADO` already exists | rejected for ambiguity |
| 2-character alias | rejected unless explicit flag |
| A real 8th finish | recognized and **escalated**; not added via self-service |
| Deleted database | rebuilt entirely from seed + log |
| Log applied halfway | transaction rolled back; no partial entry visible |

## Acceptance criteria

- [ ] **The migration is a measurable no-op**: `pnpm run eval` gives the same report before and
      after moving the catalog to SQLite, except for latency. This is what makes the migration
      defensible.
- [ ] The 7 `Finish` values and all current aliases end up in the seed, with their `AliasSource`.
- [ ] `pnpm run rules:audit` still shows the provenance of each alias (client vs added).
- [ ] An unknown finish produces a gap with the literal value, and a single backlog entry even if
      it appears in 40 rows.
- [ ] With `POLICY_UNKNOWN_FINISH=review` the line comes out with `UNMAPPED_VALUE`; with `resolve`,
      it doesn't.
- [ ] The KPI delta between the two P-12 values is measured and written down before fixing the
      default.
- [ ] All five guards have a test, each with the case it rejects.
- [ ] An addition from the front end and one via CLI produce the same log line.
- [ ] The database rebuilds from scratch and derives the same way.
- [ ] An unapproved `finish` correction is not promoted; an approved one that breaks the gold set
      isn't either.
- [ ] No existing `finish` test changes result.

## Out of scope

- **Expanding the §9 catalog to an 8th finish.** Changes the `Finish` type, the gold set, and the
  historical comparability of every KPI. It's a conversation with the client and a `SPEC-010`
  migration, not a vocabulary entry. This component **detects it and escalates it**.
- Names, qualities, and standards as data. The same pattern serves all three and they're three more
  specs; finish comes first because it's the only one that currently fails silently.
- Having an LLM propose the equivalence. Compatible with this contract, and a separate piece.
- Scope by issuer (that `tropicalizado` might mean one thing at one design office and another at
  another). See `docs/12-system-behind-the-rules.md` §4, "The issuer, sealed into the gap".

## What happens to the KPI if this is removed

The silent error keeps a hole no metric sees: an unknown finish comes out as "no finish", which §9
declares valid, so it **doesn't count as a failure anywhere** — not in silent error, not in tail
noise, not in the per-attribute breakdown. The KPI keeps being computed and stays blind to this
class, exactly as it was blind to quantity before `SPEC-009`.

And without the "data, not code" half, every MTO from a new design office with its own way of
writing finishes is a deployment. The sales pitch — *the client changes a rule without waiting for
us* — stops being true for the one attribute where getting it wrong goes unnoticed.

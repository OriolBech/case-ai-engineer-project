# SPEC-014 · Line identity and revision diff

| | |
|---|---|
| **File** | `src/domain/identity.ts`, `src/domain/revision-diff.ts` · UI and persistence: not in this delivery |
| **Stage** | Outside the hot pipeline. Runs **after** `processMto` over two `ProcessResult`s |
| **LLM** | **No** — and it's forbidden |
| **Status** | ✅ domain kernel (identity + diff) · ✅ persistence, UI, and "already exported to RFQ" |
| **Related specs** | `SPEC-001` · `SPEC-005` · `SPEC-008` · `SPEC-015` |
| **Policies it applies** | None new. A mismatch isn't resolved: it's surfaced |

## Purpose

That the buyer can see, between revision 9 and revision 12 of the **same** MTO, what material is
new, what disappeared, and what **changes in quantity** — without using the `ITEM` column or the
row number.

That's the savings the brief describes and that this case doesn't address today: *"revision 12
requests two thousand bolts that were already purchased in revision 9."* It's not matching against
the client's material master (dirty, out of scope). It's a diff of **normalized content** between
two versions of the same document.

## Why not an LLM

Matching two lines whose identity is already in seven canonical attributes is string equality. A
model here could "approximate" an M16×60 to an M16×65 and flag a different material as *already
purchased*. At 23,000:1 that error is the costly one, wearing a machine's stamp.

The temptation ("the descriptions don't match, let the model align them") is exactly the judgment
failure the case penalizes: putting a model where a table is enough. If two lines don't share a
fingerprint, **they aren't the same material**. They're listed as an addition or removal, not
matched.

## Dependency: stable identity

The diff is impossible as long as a line's identity is `ITEM` or the Excel index. `ITEM` is
optional (variant `v01`); inserting a row in revision 12 shifts every index below it. Measured in
`src/pipeline/__tests__/variants.test.ts`.

Identity comes from **the seven already-normalized attributes**, not from position on the sheet.
Quantity does **not** enter the fingerprint: it's what the diff has to detect as a change.

## Contract

### Identity

```ts
interface IdentityParts {
  name: string | null;
  material: string | null;
  quality: string | null;
  measure: string | null;
  length: string | null;
  standard: string | null;
  /** Vacío / null = "sin acabado", y es un material distinto de CINCADO (§9 no mezclar). */
  finish: string | null;
}

/** Huella canónica. `fold` de `src/rules/text.ts`. La cantidad no entra. */
function fingerprintOf(parts: IdentityParts): string;
```

### Identifiable line (domain DTO; not an `OutputLine`)

```ts
interface IdentifiableLine {
  id: string;
  fingerprint: string;
  parts: IdentityParts;
  quantity: number | null;
  status: 'RESUELTA' | 'REVISION_MANUAL';
  /** Referencias de trazabilidad, no de identidad. */
  itemRef: string | null;
  rowRef: string;
}
```

### Diff

```ts
type RevisionDelta =
  | { kind: 'unchanged'; previous: IdentifiableLine; current: IdentifiableLine }
  | { kind: 'qty_changed'; previous: IdentifiableLine; current: IdentifiableLine; from: number | null; to: number | null }
  | { kind: 'added'; current: IdentifiableLine }
  | { kind: 'removed'; previous: IdentifiableLine }
  | { kind: 'ambiguous'; fingerprint: string; previous: IdentifiableLine[]; current: IdentifiableLine[] };

function diffRevisions(previous: IdentifiableLine[], current: IdentifiableLine[]): RevisionDelta[];
```

**Invariants**

1. `fingerprintOf` doesn't read `itemRef`, `rowRef`, or `id`.
2. Two lines with the same seven normalized attributes have the same fingerprint, even if
   quantity, `ITEM`, or position change.
3. An empty finish and a `CINCADO` finish **never** share a fingerprint.
4. If the same fingerprint appears more than once on *one* side and the quantities can't be
   aligned 1:1 without extra criteria, the delta is `ambiguous`. No pairing is chosen. Fail closed.
5. The diff does **not** change `status`. It doesn't resolve, it doesn't downgrade, it doesn't
   trigger an RFQ.
6. "Already purchased" isn't a verdict from this component. It's a product annotation **on top
   of** an `unchanged` / `qty_changed` whose previous line was `RESUELTA` **and** exported. Without
   an export record, the diff only says "still here," not "already ordered."

## Behavior

1. Map every `OutputLine` to `IdentifiableLine` **after** normalizing and validating
   (SPEC-004/005). A line under review also has a fingerprint: the buyer needs to see that "the
   nut with no quality" from rev. 9 is still there in rev. 12.
2. Group by fingerprint within each revision.
3. Fingerprint only in the current revision → `added`. Only in the previous one → `removed`. In
   both, a pair, same quantity → `unchanged`. In both, a pair, different quantity → `qty_changed`.
4. A fingerprint with different cardinality on the two sides, or >1 on one side without
   disambiguation by exact quantity, → `ambiguous`. The UI shows them together with the text *it
   can't be asserted that this is the same order*.
5. Aggregate quantities **before** the diff if the product decides that two identical rows in the
   same revision are the same SKU. That aggregation is a product decision (P-2 already multiplies
   within the set). It is **not** silently aggregated across different revisions.
6. Persistence (outside this delivery): a `RevisionStore` holds `{ projectId, revisionId, lines }`.
   The pipeline doesn't read that store. Diff is a separate use case, 0 calls to the model, 0
   writes on the hot path.

## Edge cases

| Case | Behavior |
|---|---|
| Variant without the `ITEM` column | The fingerprint doesn't change. The diff still works. |
| A row is inserted at the top in rev. 12 | The `rowRef`s shift; the fingerprints don't. The bolt further down doesn't show up as an addition+removal. |
| M16×60 zinc-plated vs. M16×60 with no finish | `added` + `removed`, never `unchanged`. They're different materials. |
| Same fingerprint twice in one revision (two batches) | `ambiguous` unless explicitly aggregated *within* the revision. |
| `REVISION_MANUAL` line in both revisions | Enters the diff. Not flagged as "already purchased." |
| Material master / supplier SKU | **Out of scope.** See `docs/07-target-solution.md` #7. This spec doesn't query any master. |
| Different source text, same canonical attributes (`DIN 933` vs. already-normalized `ISO 4017`) | Same fingerprint. That's what normalization buys. |
| Different canonical attribute (`M16` vs. `M18`) | Different fingerprints. There's no "almost the same." |

## Acceptance criteria

- [x] `fingerprintOf` ignores quantity, `ITEM`, and row number (tests in `src/domain/__tests__/`).
- [x] `diffRevisions` covers addition, removal, quantity change, and the ambiguous case.
- [x] Zero imports from `src/lib/llm.ts` in `src/domain/`.
- [x] Persistence per project/revision (`RevisionStore`).
- [x] Buyer view: three buckets (new / disappeared / quantity) + ambiguous bucket, no Excel.
- [x] "Already exported to RFQ" annotation on the previous line, not inferred from the diff.

## What happens to the KPI if it's removed

**Nothing to the normalization KPI.** Silent error, autonomy, split, and queue noise don't move:
this component doesn't resolve lines.

What's lost is the **savings from the brief that isn't part of the extraction KPI**: not
repurchasing what's already been ordered. Without stable identity, that saving is zero even if the
extractor is 100% correct. That's why it's in the target solution as line 3 (identity) + line 8
(diff), and not as one more agent.

If an LLM is put in here, the normalization KPI **does** get dirty: a false `unchanged` is a
purchasing silent error, not an extraction one, and today it has no metric. That's why it's
forbidden.

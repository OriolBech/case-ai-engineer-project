# SPEC-017 · Quality vocabulary (layer 2 of §5)

> Concurrent work numbered this SPEC-016. Main already used SPEC-016 for the KPI dashboard
> (`SPEC-016-kpi-dashboard.md`), so this spec is filed as SPEC-017 to avoid the collision.

| | |
|---|---|
| **Files** | `src/rules/quality-db.ts`, `data/vocabulary/quality-alias.json`, `data/vocabulary/quality-alias.log.jsonl` |
| **Stage** | 4 · Normalization (table) · learning loop |
| **LLM** | No |
| **Status** | ✅ implemented |
| **Related specs** | `SPEC-004` · `SPEC-011` (same pattern) · `SPEC-012` (unified facade) · `SPEC-013` |
| **Policies it applies** | None new: feeds material derivation (P-3) and the validator's type/quality coherence |

## Purpose

So that a quality grade §5 does not list stops being a read-only dead end. Until now, a `45H` or a
`GR 12H` came out as `UNKNOWN_VALUE` in the backlog — *this value needs a decision* — and making
that decision meant touching TypeScript. Now the decision is a vocabulary addition, with the same
agile flow as finish: the backlog brings it with its candidate, and the buyer chooses the group.

## Why it is the last of the layer-2 tables, and what makes it different

Material and finish translate spellings. Quality does not: **declaring an entry here is declaring
two quality grades interchangeable**, and `A2-80` is not `A2` (the whole system is built on that
boundary). Concrete consequences:

1. The entry matches a **token** to one of the **14 groups in §5**. Groups cannot be created: a
   new group is a change to the client's document and is done in layer 1 (`quality.ts`), not
   from a form.
2. The **contradiction guard** is the central piece: a token §5 already lists cannot be remapped
   to another group without a warning, because that is not an alias, it is rewriting the client's
   document.
3. Layer 1 **always wins**: even if someone forces a contradictory addition, `resolveQuality`
   consults §5 first. The guard warns; the hierarchy protects.
4. The candidate group **is not proposed**. The gap brings the token; choosing the group *is* the
   decision, and suggesting it would be inventing it.

## Contract

```ts
resolveQuality(raw) → QualityResolution {
  ...QualityResult,                    // raw, canonical, group, inCatalog (from §5)
  source: 'catalog' | 'vocab' | 'ambiguous' | 'out',
  entryId: string | null,
  candidates?: { entryId, group }[],   // only on 'ambiguous'
}
```

- `catalog`: §5 knows it. Layer 2 is not even consulted.
- `vocab`: a live entry matches it by **exact** match of the folded token. `group` then feeds
  type/quality coherence (validate) and material derivation (P-3) just like a §5 value.
- `ambiguous`: two live entries take it to different groups. **No choice is made**: `group` stays
  `null` and coverage reports it asking for one to be retired. A coinflip here buys the wrong
  steel.
- `out`: nobody knows it. The line keeps the value as-is (§5) and coverage opens an
  `UNKNOWN_VALUE` gap with a candidate.

### Guards

Hard (not even with `force`): empty token, group outside the 14, duplicate id.

Policy (amber warning with `force`, cut without it): contradiction with §5, conflict with another
live layer-2 entry, gold-set regression (a CERTAIN quality cell cannot change how it is read).

### Traceability

Append-only JSONL log as the source of truth (`quality-alias.log.jsonl`, in git); SQLite as a
materialized view rebuilt on every open. The seed is born **empty** on purpose: layer 2 only grows
from recorded decisions. An id is never reused; retirement is with a reason.

### What the line emits

The value **exactly as written**, always. The rule records the layer:
`quality:G5` (§5) · `quality:vocab:<id>:G9` (layer 2) · `quality:vocab:ambiguous` ·
`quality:out_of_catalog`.

## Agile addition

- From `/vocabulario` (`?attr=quality&alias=45H`): token + dropdown of the 14 groups with their
  equivalences visible + reason.
- From the backlog (`KpiPanel`): the quality `UNKNOWN_VALUE` gap brings a candidate and a quick
  add.
- Unlike finish and material, **there is no live re-application** on the open MTO: the group moves
  coherence and material derivation, and that is recalculated on the server when reprocessing.

## Acceptance criteria

- [x] A quality outside §5 with a layer-2 entry resolves group, coherence, and material.
- [x] Layer 1 always wins: `A4-80` stays G4 even if someone forces it to G2.
- [x] Ambiguity between live entries: it is not chosen, it is reported.
- [x] Contradiction guard against §5, conflict in layer 2, and gold-set regression.
- [x] `/vocabulario` lists §5 (`client`) and layer 2 (`added`) together; add and retire from the
      facade.

## Out of scope

- Creating new groups (layer 1, the client's document).
- Addition with a mandatory signature (who + reason as a hard requirement). Today it is the agile
  flow with amber guards, by product decision; if a substitution requires a signing owner, that is
  an approval console (see `docs/07-target-solution.md`).
- Editable name and standard: same pattern, two more specs.

## What happens to the KPI if this is removed

Qualities outside §5 become read-only dead ends again: every engineering firm with its own grade
spelling ends up in a deployment or in a line with no group — no coherence and no derived material
— forever.

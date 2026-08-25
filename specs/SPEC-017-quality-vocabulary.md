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
- From the line (`TracePanel` → `LineDecisions`), in the drawer that opens on clicking the row —
  **whenever the line's quality is outside §5 and has no layer-2 entry** (`quality:out_of_catalog`),
  not only when a gap was raised. §5 grades like `GR L7` never produce a gap (§5 says to keep them
  verbatim) and were previously undecidable from the UI. The gap, when there is one, supplies the
  candidate. Not in the KPI panel — that one counts the decisions, it does not take them
  (SPEC-008 §3).
- The panel shows the group's members, so what is being decided reads as what it is: *what is this
  interchangeable with*. Ambiguity is excluded on purpose — two conflicting entries are not fixed by
  adding a third.

### The three exits

Picking one of the fourteen used to be the **only** exit, and that was a defect rather than caution.
For a quality interchangeable with none of them — `GR 660`, a nickel-base alloy — the sole way to
save anything was to declare an equivalence that is **false**: the form pushed the buyer into
breaking the very invariant it exists to protect, in the way that ends with `8.8` shipped where the
drawing said `GR 660`. Finish already had "declare a new one"; material has "not derivable".

1. **Equivalent to a §5 group** — the original behaviour.
2. **Equivalent to a group we already created** — two out-of-§5 qualities that *are* interchangeable
   with each other share one.
3. **A new quality, equivalent to nothing** — it opens its own group, `kind: 'new_group'`, and
   declares no equivalence at all. Its reason is **mandatory**.

**Layer 1 is still exactly fourteen.** A group of ours is born in our layer with the `V-` prefix
(`V-GR-660`), and the prefix is load-bearing: the client's document and our decisions must never be
mistakable for one another — not in the table, not in the log, not in a purchase's trace. The type
system carries the split (`ClientQualityGroup` / `OwnQualityGroup`), an id that is neither is still
an error rather than a group, and the §5-contradiction guard is unchanged: moving `8.8` out of G5 is
rewriting the client's document, and it is refused (or warned, under the demo's `force`).

Own groups produce no type incoherence — §5 says nothing about them, so `checkCoherence` returns
null — and they can carry a material derivation like any other group.
- Unlike finish and material, **there is no live re-application** on the open MTO: the group moves
  coherence and material derivation, and that is recalculated on the server when reprocessing.

## Acceptance criteria

- [x] A quality outside §5 with a layer-2 entry resolves group, coherence, and material.
- [x] Layer 1 always wins: `A4-80` stays G4 even if someone forces it to G2.
- [x] Ambiguity between live entries: it is not chosen, it is reported.
- [x] Contradiction guard against §5, conflict in layer 2, and gold-set regression.
- [x] `/vocabulario` lists §5 (`client`) and layer 2 (`added`) together; add and retire from the
      facade.
- [x] A quality that equals none of the fourteen can be saved **without** declaring a false
      equivalence: it opens its own `V-` group, interchangeable with nothing
      (`src/rules/__tests__/quality-new-group.test.ts`).
- [x] `QUALITY_GROUPS.size === 14` after any number of own groups are created.

## Out of scope

- Editing **layer 1**: the fourteen §5 groups are the client's document. Declaring a group of *ours*
  (`V-…`) is a different act and it is in scope — see "The three exits".
- Addition with a mandatory signature (who + reason as a hard requirement). Today it is the agile
  flow with amber guards, by product decision; if a substitution requires a signing owner, that is
  an approval console (see `docs/07-target-solution.md`).
- Editable name and standard: same pattern, two more specs.

## What happens to the KPI if this is removed

Qualities outside §5 become read-only dead ends again: every engineering firm with its own grade
spelling ends up in a deployment or in a line with no group — no coherence and no derived material
— forever.

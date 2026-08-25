# SPEC-012 · Unified vocabulary

| | |
|---|---|
| **Files** | `src/rules/vocab.ts`, `src/rules/vocab-model.ts`, `app/api/vocabulary/route.ts`, `app/components/VocabularyView.tsx`, `app/vocabulario/page.tsx` |
| **Stage** | Front end + data layer (cross-cutting over 4) |
| **LLM** | No |
| **Status** | ✅ implemented |
| **Related specs** | `SPEC-008` · `SPEC-011` · material vocabulary (`src/rules/vocabulary-db.ts`) |
| **Policies applied** | None new: routes additions to the tables that already apply P-3 and P-12 |

## Purpose

A single vocabulary view for the buyer, instead of one screen per attribute. The attribute is a
**filter**, not a route. The `→ vocabulario` links from the queue or the backlog land on
`/vocabulario?attr=<attribute>&alias=<text>` and open the addition form pre-filled.

## Why not an LLM

It's a table facade. It adds no domain logic: it translates the material and finish tables into a
common shape (`VocabEntry`) and routes the addition. A model here would silently mix "what the
client's document says" with "what we decided."

## Contract

```ts
export type VocabAttribute = 'name' | 'material' | 'quality' | 'norma' | 'finish';

export const VOCAB_ATTRIBUTES: { key: VocabAttribute; label: string; editable: boolean }[] = [
  { key: 'name',     label: 'Nombre',    editable: false },
  { key: 'material', label: 'Material',  editable: true  },
  { key: 'quality',  label: 'Calidad',   editable: true  },
  { key: 'norma',    label: 'Norma',     editable: false },
  { key: 'finish',   label: 'Acabado',   editable: true  },
];
```

Today **material** (P-3, derivation), **quality** (layer 2 of §5, SPEC-017), and **finish**
(SPEC-011) are editable. Name and standard are closed catalogs owned by the client (§3, §8): they're
listed read-only, with their real entries, so the buyer can see everything the system knows how to
translate.

### HTTP

Replaces `/api/vocabulary` (material only) and `/api/finish-vocabulary` (finish only). A single
route: `GET/POST/DELETE /api/vocabulary`.

- `GET` → `{ entries, uncovered, finishCatalog }`
- `POST` → addition. Demo default: `force: true` (policy guards travel as `warnings`;
  something structurally impossible — duplicate id, alias with no finish, material that isn't
  AC/INOX — responds 422 and isn't saved).
- `DELETE` → retirement with reason. The id isn't reused.

An addition from this route is indistinguishable from `pnpm run vocab` / `pnpm run finish:vocab`.

## Behavior

1. The front end consumes **only** the types from `vocab-model.ts`, never those of each individual
   table.
2. This file doesn't import `node:sqlite`: it's shared by client and server.
3. Re-adding a retired alias mints a new id (`allocateId`); otherwise `addEntry` responds "already
   exists," making it look like the deletion never took effect.
4. The addition **doesn't block** in the demo: a guard is painted amber and the entry is saved.
   Whoever wants the classic blocking behavior sends `force: false`.
5. Applying an addition while the MTO is open rewrites, live, the lines whose `raw` matches
   (`SuggestionPatch` in `App.tsx`) and leaves them to be revalidated. That's `SPEC-013`, not this
   spec: this spec only writes the vocabulary.

## Acceptance criteria

- [x] `/vocabulario` shows all five attributes; material, quality, and finish can be extended; the
      rest are read-only.
- [x] `?attr=finish&alias=tropicalizado` opens the addition form pre-filled.
- [x] `/vocabulario/acabado` and `/api/finish-vocabulary` no longer exist.
- [x] A finish addition, a material addition, and a quality addition from this view write to their
      respective logs.
- [x] Name and standard are listed with the tables' real entries, not a placeholder.

## Out of scope

- Policy console (a different object: approved with the KPI delta, not with the ambiguity
  guard). See `docs/03-policies.md`.
- Making name and standard editable. Same pattern, two more specs.
- Persisting session suggestions. That's `SPEC-013`.

## What happens to the KPI if removed

The pipeline keeps resolving. The sales argument is lost: *the client changes a rule without
waiting on us*. Every MTO from a new engineering firm, with its own way of writing things, ends up
requiring a deployment.

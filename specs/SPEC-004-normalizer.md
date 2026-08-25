# SPEC-004 · Normalizer

| | |
|---|---|
| **Files** | `src/pipeline/normalize.ts`, `src/rules/*.ts` |
| **Stage** | 4 |
| **LLM** | **No** — and it's a decision, not a limitation |
| **Status** | ✅ implemented |

## Purpose

Bring each extracted value to its normalized concept using the client's tables, or mark it as
having no equivalence.

## Why NOT an LLM

These are four closed, exhaustive tables the client has already written. A model here would be
slower, more expensive per token, not reproducible — and the challenge requires traceability — and
above all capable of inventing an equivalence that isn't in the table. It's the textbook case of
the criterion "putting a model where a table was enough."

## Tables

| Table | File | Entries | Origin |
|---|---|---|---|
| Names | `rules/names.ts` | 5 values, ~11 aliases | Rules §3 |
| Quality | `rules/quality-groups.ts` (lookup in `quality.ts`) | 14 groups G1–G14 | Rules §5 |
| Standards | `rules/standards.ts` | 25 DIN→ISO/EN equivalences | Rules §8 |
| Finishes | `rules/finish-db.ts` (adapters in `finish.ts`) | 7 values, aliases in SQLite + log | Rules §9 · SPEC-011 |
| Layer-2 aliases | `rules/generic-alias-db.ts` | Name, quality and standard additions | Approved corrections · SPEC-015 |

## Behavior

1. **Names.** Alias → one of the 5 values. The catalog doesn't distinguish subtypes: `Tornillo
   Allen` (Allen bolt) and `Tornillo hexagonal` (hex bolt) are both `TORNILLO` (BOLT); `Tuerca
   autoblocante` (self-locking nut) is `TUERCA` (NUT). What tells them apart is the standard.
2. **Quality.** If the value is in a group, both the group **and** the canonical value are
   returned. Two values in the same group are equivalent; **values from different groups are
   not**, and in particular `8.8` (G5) is **not** `8` (G8). If the value is flagged as a quality
   grade but is outside the list (ASTM grades `GR B7`, `GR 2H`), it's kept as-is with
   `inCatalog: false`.
3. **Standards.** If the DIN designation is in the table of 25, it's replaced with its ISO/EN
   equivalent. If it isn't, **it's kept as-is**: not every one has an equivalent. Once
   normalized, it's used with its exact structure.
4. **Finishes.** Alias → one of the 7, via `resolveFinish` (SPEC-011). Absence of a finish is a
   valid value and **doesn't** send the line to review. An alias the table doesn't recognize is
   left `unmapped`; SPEC-005 applies P-12.
5. **Material.** Minimal semantic normalization: `ACERO`/`STEEL`/`acero` → `AC`. Deriving it from
   the quality grade is SPEC-005 via P-3, not here.
6. **Measure and length.** Format canonicalization only (`7/8"`, `M20`, `130 mm`). **There are no
   equivalences between inches and metric** and they're never converted.
7. **The length embedded in the designation.** `M16x60` is a string with a diameter and a length
   inside it, and splitting it is a regex. `parseMeasure` returns `lengthRaw` (the `60`, without a
   unit) and the validator uses it **as a fallback**: if the extractor placed a length, its value
   wins, with its own span.

   It exists because row 4 of the gold set was going to review with `LENGTH_MISSING` over a
   length the row does write: the model returned `measure: "M16x60"` and `length: null`, and the
   only path to that `60` was for the model to repeat it in a second field. Same boundary as
   `findNames` over the model's classification and as multiplicity (SPEC-002).

   **No unit is assumed here.** `resolveLength` still applies §7 and P-4: `M16x60` resolves via
   the ISO designation (certain) and `7/8" X 130` goes through the plausibility range like any
   other unitless imperial length.

8. **Vocabulary layers.** For name, quality and standard, the client's catalog (layer 1,
   immutable) is consulted first, and only afterwards `generic-alias-db` (layer 2, SQLite +
   append-only log). An attempt to add a layer-2 alias that reuses a layer-1 alias is rejected.
   For quality, the alias contributes the group and the trace, but the emitted value remains the
   text as written in the MTO.

   **And it doesn't travel along with an extrapolated measure.** §2 allows extrapolating the
   measure and nothing else; taking the `60` from an inherited `M16x60` would be extrapolating
   the length while calling it the measure. It's the project's first invariant, and the shortcut
   that breaks it is exactly the convenient one. With a test that fails without the guard.

## Edge cases

| Case | Behavior |
|---|---|
| `M16x60` with no `length` field (row 4) | The length comes from the designation: `60 mm`, certain |
| `M16x60` inherited by a secondary element | Inherits the diameter; the length **does not**, and comes out as `LENGTH_MISSING` |
| `DIN 975` (row 9) | Not in the table of 25 → kept as `DIN 975` |
| `DIN 125 A` | In the table → `ISO 7089` |
| `DIN985` with no space | Format is normalized before lookup → `ISO 10511` |
| `A2` and `304` | Same group G1, equivalent |
| `8.8` on a nut | Normalized to G5. The inconsistency is flagged by SPEC-005 |
| `GR B7` | Outside the catalog, kept as-is, `inCatalog: false` |
| Unknown finish alias | Raw value kept and marked `unmapped`; SPEC-005 applies P-12 |

## Acceptance criteria

- [x] All 26 keys of the DIN table are applied, and a DIN outside the table is kept as-is (`DIN 975`).
- [x] `8.8` never converts to `8` or vice versa. `areEquivalent('8.8','8') === false`.
- [x] All 14 groups exist and **all 23 values** resolve to their group.
- [x] Two-letter aliases (`ZN`, `ZP`, `BL`) are bounded to whole words: they don't fire inside another word.
- [x] `STUD BOLT` resolves to `ESPARRAGO`, not to `TORNILLO` (longest alias first).
- [x] Formats never seen in the MTO: `ASME`, `MSS SP`, `DIN EN`, plain `ISO`.
- [x] `DIN 6923` → `EN 1661`, the only entry that doesn't go to ISO.
- [x] No function calls a model. The only I/O is the deterministic reading of the SQLite
      vocabulary, same as material and finish.
- [x] Deterministic and with no external dependencies.

## Alias provenance

The client's tables are the source of truth. Every alias we've added — gender and number
inflections, and other languages — carries `source: 'added'` and is listed with
`pnpm run rules:audit`, so it can be defended one by one. Current status: 11 from the client + 24
added for names, 19 + 16 for finishes, 4 + 10 for materials.

## What happens to the KPI if it's removed

Attributes come out unnormalized: they can't be grouped by family or matched against a supplier,
which is the whole point of the project. `useful_autonomy` → ~0.

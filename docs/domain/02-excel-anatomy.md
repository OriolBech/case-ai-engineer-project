# 2 · Anatomy of the Excel file

File: `data/input/MTO_tornilleria.xlsx`. One sheet, no formulas, no `sharedStrings` (everything is
`inlineStr`), no relevant merged cells.

## Physical structure

| Row | Content |
|---|---|
| 1 | Title: `MTO DE PRUEBA - SETS DE TORNILLERIA` (cell `A1`, not a header) |
| 2–3 | **Empty** |
| 4 | Real header: `ITEM · DESCRIPCION · MATERIAL · MEDIDA · CANT. · UD` |
| 5–19 | The 15 data items |

**Consequence for the parser:** the header isn't in row 1. It can't be read blindly with a
`read_excel(header=0)` — the header row has to be located by searching for the labels, because the
next MTO that arrives will have the title somewhere else, or two rows of logo. Header detection is
code, not a constant.

## The 6 columns, one by one

### `A` · ITEM
MTO line number, `1`…`15`. It's text, not a number. It serves as a **traceable reference**: it's
what the buyer cites when calling engineering ("item 9 has no nut quality grade"). In the output
it's `rowRef`. In real MTOs it appears as `1.0`, `1.1`, `2.0`… with a hierarchy by spool; here it's
flat.

### `B` · DESCRIPCION (DESCRIPTION) ← **the source of truth**
Free text. **90% of the information is here.** It contains, in any order and in any language: the
element type, the standard, the size, the length, the quality grade, the finish, and the
accompanying set elements with their own standards and sometimes their own quality grades.

It's the only field that is actually extracted from. Everything else is corroboration.

### `C` · MATERIAL ← **the name lies**
It doesn't contain materials. Across the 15 rows it contains:

| What it actually contains | Rows | Example |
|---|---|---|
| A metric/stainless **quality grade** | 2,3,4,6,7,8,9,10,11,13,15 | `8.8`, `A4-70`, `A2`, `12.9` |
| A **standard + grade** ASTM | 1,5,12 | `ASTM A193 GR B7`, `ASTM A193 GR B7/A194 GR 2H` |
| An actual **material** | **14** | `acero` (steel) |

Only one row out of fifteen writes the material. This is the fact behind policy `P-3` (deriving
`AC`/`INOX` from the quality grade): without derivation, 14 of 15 rows end up without a material.

An important detail in row 1: `ASTM A193 GR B7/A194 GR 2H` packs **two quality grades from two
different elements into one cell**, separated by `/`. It's information about the set, not about a
single element. And notably it **doesn't mention the washer** `F436` that does appear in the
description — another reason the description takes precedence.

### `D` · MEDIDA (SIZE) ← **redundant and not always complete**
A summary of size and length that's already in the description:

| Pattern | Rows | Reads as |
|---|---|---|
| `M{d}x{L}` | 2,3,4,6,7,8,9,10,15 | metric diameter × length in mm |
| `{fraction}" X {L}` | 1,5,12 | diameter in inches × length (unit not written → `P-4`) |
| `M{d}` without length | 11,13,14 | diameter only: these are nut/nut/washer, which don't carry a length (`§7`) |

Useful as a **cross-check**: if the regex over the description extracts `M16x60` and this column
says `M16x60`, confidence goes up. If they disagree, it's a signal for review. It's never the
primary source, because it only describes the set's principal element and stays silent about the
rest.

### `E` · CANT. (QTY.)
Quantity. **It's the quantity of the principal element**, not of the set or of each element. In
row 1, `40` is 40 studs → 80 nuts and 80 washers. The set decomposition multiplies this quantity;
it doesn't divide it.

Range in the file: 24 … 500. Text, not a number.

### `F` · UD (UNIT)
Unit of measure for the quantity. Constant `uds` (units) across the 15 rows. In real MTOs you also
see `m`, `kg`, `pcs`, `EA` (*each*), `set`. **If it ever says `set`, the arithmetic of column `E`
changes completely** (40 sets = 40 studs + 80 nuts, vs. 40 units = ambiguous). It deserves an
explicit validation, not a silent `assert`.

## The 15 rows, translated

Notation: **P** = principal element, **s** = secondary element of the set. `⚠` = a point where the
row forces a policy to be applied.

---

**Row 1** · `STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436` · `40 uds`

> A 7/8-inch stud bolt, 130 long, standard ASTM A193 grade B7, **with** 2 hex nuts of 7/8" standard
> ASTM A194 grade 2H, and 2 washers of 7/8" standard ASTM F436.

A 3-element set, imperial, ASTM world (pressure piping). Canonical flanged joint.
- **P** ESPARRAGO (STUD BOLT) · A193 B7 · 7/8" · 130 · 40 uds
- **s** TUERCA (NUT) · A194 2H · 7/8" (written, not extrapolated) · 80 uds
- **s** ARANDELA (WASHER) · F436 · 7/8" · 80 uds ⚠ **no quality grade** → `REVISION_MANUAL` (`§5`)
- ⚠ `130` without unit → `P-4`. ⚠ material not written → `P-3`.

---

**Row 2** · `BOLT DIN931 M20x90 with NUT DIN934 M20` · `A4-70` · `160 uds`

> Partial-thread hex bolt DIN 931, metric 20 × 90 mm, with hex nut DIN 934 M20.

- **P** TORNILLO (BOLT) · ISO 4014 (ex DIN 931) · A4-70 → INOX · M20 · 90 mm · 160 uds
- **s** TUERCA (NUT) · ISO 4032 (ex DIN 934) · M20 · ⚠ **no quality grade of its own** → review
- ⚠ `with NUT` without multiplicity → `P-2` (160 or 320?)

---

**Row 3** · `Tornillo hexagonal DIN 933 M12 x 50 con tuerca y arandela` · `A2` · `80 uds`

> Full-thread hex bolt DIN 933 M12 × 50, with nut and washer.

The poorest row in the file: the nut and the washer **have no standard and no quality grade**.
- **P** TORNILLO (BOLT) · ISO 4017 (ex DIN 933) · A2 → INOX · M12 · 50 mm · 80 uds
- **s** TUERCA (NUT) · ⚠ no standard (`P-5`) ⚠ no quality grade (`§5`) → double review
- **s** ARANDELA (WASHER) · same → double review

---

**Row 4** · `BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated` · `8.8` · `100 uds`

> Bolt DIN 933 M16×60 with nut DIN 934 and washer DIN 125, quality grade 8.8, zinc plated.

A 3-element set with the finish written **once, at the end of the row.** Does it extend to the nut
and the washer?
- **P** TORNILLO (BOLT) · ISO 4017 · 8.8 → AC · M16 · 60 mm · CINCADO (ZINC PLATED) · 100 uds
- **s** TUERCA (NUT) · ISO 4032 · ⚠ quality grade and finish only by extrapolation
- **s** ARANDELA (WASHER) · ISO 7089 (ex DIN 125) · same
- ⚠ **the textbook case of `P-1`**: under the rule of not mixing finishes, whether to extrapolate
  or not changes which material is being purchased.

---

**Row 5** · `STUD BOLT 1" X 150 LG, ASTM A193, GR B7, W/ 2 NUT ASTM A194, GR 2H, 1 WASHER ASTM F436` · `24 uds`

Same as row 1 but with **1 washer per stud**, not 2. Confirms multiplicity is read, not assumed:
24 studs → 48 nuts → **24** washers.

---

**Row 6** · `Tornillo DIN 931 M16 x 80 con tuerca DIN 934, 8.8, zincado` · `8.8` · `60 uds`

Spanish twin of row 2 + finish. `zincado` → `CINCADO`. A 2-element set. ⚠ `P-1`, ⚠ `P-2`.

---

**Row 7** · `BOLT DIN931 M12x60 A4-70 with NUT DIN934 M12 A4-80` · `A4-70` · `50 uds`

**The well-written row.** It's the only one where **each element carries its own quality grade**,
and they're *different*: bolt `A4-70` (group G3), nut `A4-80` (group G4). Nothing to extrapolate,
nothing to review. It's the counterexample that proves extrapolating quality grade would be a
mistake: here it would have given `A4-70` to the nut, which is a different specification.

---

**Row 8** · `HEX BOLT M16 x 70 c/w NUT AND WASHER, 8.8, ZN` · `8.8` · `75 uds`

> Hex bolt M16×70, complete with nut and washer, 8.8, zinc plated.

- ⚠ **the bolt has no standard**: `HEX BOLT` without DIN/ISO → `P-5`. The nut and washer don't
  either.
- `c/w` = *complete with*. `ZN` = zinc plated.
- ⚠ `P-1` (set finish), ⚠ `P-2` (multiplicity), ⚠ `P-5` (standard) on all three lines.

---

**Row 9** · `Conjunto esparrago M20 x 200 DIN 975 con 2 tuercas DIN 934 y 2 arandelas DIN 125, 8.8, zincado` · `8.8` · `30 uds`

The most complete metric 3-element set, in Spanish. **Explicit** multiplicity (`2 tuercas`,
`2 arandelas`) → 30 / 60 / 60.
- ⚠ **Type/standard conflict:** the word used is `esparrago` (→ `ESPARRAGO` per `§3`), but **DIN
  975 is a threaded rod**, not a stud bolt. See [05-standards.md](05-standards.md). The written rule
  classifies by the word; the standard says otherwise. Worth flagging even while respecting the
  rule.
- ⚠ DIN 975 **is not in the equivalence table** → kept as-is (`§8`, last paragraph).

---

**Row 10** · `Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado` · `8.8` · `500 uds`

**Clean row, single element.** 7 complete attributes (with `P-3` for the material). No set, no
ambiguity. It's the base case to measure against: if this fails, everything fails.

---

**Row 11** · `Tuerca hexagonal DIN 934 M16, A4-80` · `A4-80` · `200 uds`

Loose nut, stainless, no length — **correct**: `§7` exempts nuts and washers from length.
Coherent (A4-80 is a valid nut quality grade). Clean case.

---

**Row 12** · `STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7` · `40 uds`

A **loose** stud bolt, no nuts or washers. Proves that "STUD BOLT" doesn't imply a set. ⚠ `P-4`
(`110` without unit), ⚠ `P-3`.

---

**Row 13** · `Tuerca autoblocante DIN 985 M12, 8.8, zincada` · `8.8` · `300 uds`

> Self-locking nut (with nylon insert) DIN 985 M12, 8.8, zinc plated.

- ⚠ **the planted case of `P-6`:** a **nut** with quality grade **8.8**. The rules say nut quality
  grades are `8` and `10`; `8.8` belongs to bolts (group G5 ≠ G8). Never silently convert →
  `QUALITY_TYPE_INCOHERENCE`.
- `autoblocante` (self-locking) is a subtype the catalog doesn't distinguish (`§3`): it's still
  `TUERCA`. What distinguishes it is the standard DIN 985 → ISO 10511.

---

**Row 14** · `Arandela plana DIN 125 M10, acero, zincada` · `acero` · `250 uds`

**The only row that writes the material.** `acero` (steel) → `AC` by semantic normalization
(`§4`).
- ⚠ And **it has no quality grade**: `§5` sends it to review (`QUALITY_MISSING`) even though it
  has the other six attributes. It's the perfect counterexample: the row with the explicit
  material is the one that falls through.
- ⚠ `M10` on a washer means "for an M10 bolt" (Ø10.5 hole), not "M10 thread": washers don't have
  threads.

---

**Row 15** · `Tornillo Allen cilindrico DIN 912 M10 x 40, 12.9, geomet` · `12.9` · `120 uds`

> Socket head cap screw (hex socket) DIN 912 M10×40, quality grade 12.9, Geomet finish.

Single element, complete. `Allen cilíndrico` (socket head) is a subtype → `TORNILLO` (`§3`); it's
distinguished by standard ISO 4762. `12.9` + `geomet` is a **technically coherent** combination,
and not a coincidence: see [07-finishes.md](07-finishes.md), hydrogen embrittlement.

## Summary of the file's shape

| Characteristic | Count | Rows |
|---|---|---|
| Data rows | 15 | 1–15 |
| Rows describing a **set** (>1 element) | 9 | 1–9 |
| Single-element rows | 6 | 10–15 |
| Language: English / Spanish | 7 / 8 | 1,2,4,5,7,8,12 / rest |
| System: metric / imperial | 12 / 3 | — / 1,5,12 |
| World: DIN·ISO / ASTM / no standard | 11 / 3 / 1 | — / 1,5,12 / 8 |
| Rows with finish written | 7 | 4,6,8,9,13,14,15 |
| Rows that write the material | 1 | 14 |
| Rows missing the quality grade for some element | 5 | 1,2,3,4,8 (+14 entirely) |
| Rows with implicit multiplicity | 3 | 2,3,8 |

Only four rows (**7, 10, 11, 15**) are resolved by applying only `P-3`, the material derivation.
The remaining eleven force a decision the client's rules don't settle. **That's the case**: it's
not an extraction problem, it's a problem of declared policy.

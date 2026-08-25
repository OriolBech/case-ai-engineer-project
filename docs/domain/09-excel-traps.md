# 9 · Excel traps

Operational checklist. Each entry is a specific spot where a reasonable parser gets it wrong,
with the row that proves it and the policy that covers it. If you're implementing, this is the
page you keep open.

## 9.1 · File traps

| # | Trap | Evidence | What to do |
|---|---|---|---|
| F1 | The header is **not** on row 1 | Row 1 = title, 2–3 blank, header on row 4 | Detect the header row by looking for labels, don't assume an index |
| F2 | Everything is **text**, not numbers | `CANT.` = `'40'`, `ITEM` = `'1'` | Convert with validation, don't trust the declared type |
| F3 | `8.8` can arrive as a *float* | If the original MTO had it as a number, Excel stores it as numeric `8.8` | Normalize to string before matching quality |
| F4 | `8,8` with a **decimal comma** | Not in this file; common in European offices | Accept both separators |
| F5 | The `UD` column is constant… **today** | 15/15 = `uds` | Validate explicitly. If it says `SET`, the quantity arithmetic changes |
| F6 | No `sharedStrings.xml` | The file uses `inlineStr` | Any standard reader handles it; only matters if the XML is parsed by hand |
| F7 | The column name is **not** the attribute | `MATERIAL` contains quality or standard | `§4` warns about this. Never map column→attribute by name |

## 9.2 · Content traps

| # | Trap | Row | Policy |
|---|---|---|---|
| C1 | **One row ≠ one material.** In the given MTO, 15 rows → 30 lines | 1–9 | `§2` |
| C2 | The `MATERIAL` column doesn't carry material in 14/15 rows | all but 14 | `P-3` |
| C3 | Length has no unit | 1, 5, 12 | `P-4` |
| C4 | Measure in inches + length in mm in the same row | 1, 5, 12 | `P-4` |
| C5 | Explicit multiplicity (`W/2`) vs. implicit (`with NUT`) | 1, 5, 9 vs 2, 3, 8 | `P-2` |
| C6 | **Asymmetric** multiplicity: 2 nuts but 1 washer | 5 | `P-2` |
| C7 | Finish is written once at the end of a row that's a set | 4, 6, 8, 9 | `P-1` |
| C8 | Missing quality for secondary elements | 1, 2, 3, 4, 8 | `§5` → review |
| C9 | Missing standard for the primary element | 8 (`HEX BOLT`) | `P-5` |
| C10 | Both standard **and** quality missing for secondaries | 3 | `P-5` + `§5` |
| C11 | Nut with a bolt's quality (`8.8`) | 13 | `P-6` |
| C12 | Row with explicit material **but no quality** | 14 | `§5` → review |
| C13 | Standard not in the equivalence table | 9 (`DIN 975`) | `§8` → keep as-is |
| C14 | Type/standard conflict: word `esparrago` (stud) + rod standard | 9 | log signal, respect `§3` |
| C15 | Two standards and two grades in one cell separated by `/` | 1 (`ASTM A193 GR B7/A194 GR 2H`) | description rules |
| C16 | `MATERIAL` column incomplete relative to the description | 1 (doesn't mention `F436`) | description rules |
| C17 | Subtypes the catalog collapses (`Allen`, `self-locking`) | 13, 15 | `§3` |
| C18 | `M10` on a washer is **not** a thread | 14 | semantics by type |
| C19 | Two languages in the same file | 7 English / 8 Spanish | bilingual recognizer |
| C20 | `DIN931` and `DIN 931` in the same file | 2, 4, 7 vs 3, 6, 9, 10 | normalize separators |
| C21 | The measure is **already written** for the secondary, no need to extrapolate | 1 (`HEX. NUT 7/8"`) | prefer `extracted` over `extrapolated` |
| C22 | **Different** qualities per element within the set | 7 (`A4-70` / `A4-80`) | never extrapolate quality |

## 9.3 · Traps not present in this file

The ones you need to have front of mind before seeing the blind set. These aren't speculation:
they're what any real piping MTO produces.

| # | Trap | Why it hurts |
|---|---|---|
| B1 | **Row that isn't a fastener** (flange, gasket, pipe, valve) | `P-9`. The worst failure mode: 7 plausible attributes invented for a material that isn't one |
| B2 | **Stainless** ASTM grade (`GR B8`, `B8M`) | Breaks a material derivation that assumes "ASTM → AC" (carbon steel). See `06-qualities.md` §6.7 |
| B3 | **Fine thread pitch** (`M20x1,5x90`) | `M(\d+)x(\d+)` parses it wrong silently. The client's own table includes DIN 960/961: it expects this |
| B4 | Compound fraction (`1-1/8"`) | The hyphen separates the whole-number part, it's not a minus sign |
| B5 | `PLAIN` / `SELF-COLOUR` as "finish" | They mean *no finish*. Normalizing them creates a finish that doesn't exist |
| B6 | `ZINC FLAKE` with no brand | It's the Geomet/Dacromet category. Picking one is inventing → review |
| B7 | `UD` = `SET` or `m` | Changes the quantity arithmetic entirely |
| B8 | Length outside the physically plausible range | `P-4` sends it to review (`LENGTH_UNIT_IMPLAUSIBLE`) instead of resolving it wrong |
| B9 | Set with more than 3 elements, or with two different bolts | The split has to be N-ary, not a three-case `if` |
| B10 | Hierarchical item number (`1.0`, `1.1`, `1.2`) | `rowRef` isn't an integer |
| B11 | `HV` quality on a bolt | `P-8`. It's resolved, not sent to review, and there's a flag for the opposite |
| B12 | Finish/quality inconsistency (`12.9` + `zincado`/galvanized) | Hydrogen embrittlement. Not covered by the rules today; see `07-finishes.md` §7.3 |
| B13 | Bolt with no length | Missing a required field (`§7`), unlike a nut/washer |
| B14 | Duplicate row with a different finish | These are two materials (`§9`), not a duplicate to deduplicate |

## 9.4 · The three golden rules

If you take three things away from this whole folder:

**1. The description rules.** The `MATERIAL` and `MEDIDA` (measure) columns are a redundant,
incomplete, and sometimes misleading summary of what's already in `DESCRIPCION`. They're used to
**corroborate** and to **detect discrepancies**, never as the primary source. Row 1 proves it: its
`MATERIAL` column (`ASTM A193 GR B7/A194 GR 2H`) says nothing about the `ASTM F436` washer that the
description does write.

**2. Absent, not applicable, and unknown are three different things.** A nut with no length is
complete (`not_applicable`). A bolt with no length is incomplete (`absent`). A quality that you
can't tell is marked as quality isn't extracted (`§5`). If the data model collapses them all to
`null`, it loses the information that decides between `RESUELTA` and `REVISION_MANUAL`.

**3. Don't fill in with the most likely value.** This is the client's first rule (`§1`): *"an
attribute the MTO doesn't state is not filled in with the most likely value."* Everything this
document says about industry practice —that DIN 125 implies 200HV, that the B7/2H/F436 trio always
goes together, that the nut for an 8.8 bolt is class 8— is **knowledge for understanding the file,
not for completing it**. The moment it's used to fill in a cell, it has turned into a
well-presented hallucination. And that is exactly the error this case is measuring.

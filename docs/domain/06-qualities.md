# 6 · Grades

**"Calidad" (grade) is a false friend.** It doesn't mean "good or bad": it means **class of
mechanical strength and/or material composition**. It's the most information-dense attribute in the
whole line: material, behavior, and often price are deduced from it.

It's also the only attribute whose absence sends the line to review by a written rule (`§5`).

## 6.1 · The four grammars

The client's grade list mixes four systems that have nothing to do with one another:

| Family | What it is | Material | Reference standard | Values |
|---|---|---|---|---|
| **Carbon / alloy steel** | Strength class | `AC` | ISO 898-1 | `8.8` `10.9` `12.9` `GRADE 5` `GRADE 8` |
| **Steel nuts** | Nut class | `AC` | ISO 898-2 | `8` `10` |
| **Stainless** | Steel group + strength | `INOX` | ISO 3506 | `A2` `A4` `A2-70` `A4-70` `A2-80` `A4-80` `18-8` `304` `316` |
| **Hardness (washers)** | Vickers hardness | steel, nothing more | ISO 7089/7093 | `100HV` `140HV` `160HV` `200HV` `300HV` |
| *(off the list)* | ASTM grade | `AC` | ASTM A193/A194 | `GR B7` `GR 2H` |

The fact that these are different grammars is why the client's equivalence table has 14 groups
instead of a single ordered scale. **There is no total ordering across groups.** `A4-80` isn't
"better" than `10.9`: it's a different thing entirely. Comparison only makes sense *within* a group,
and within a group the values are identical.

## 6.2 · Steel: `8.8`, `10.9`, `12.9`

The number has an exact mechanical reading (ISO 898-1):

```
      8   .   8
      │       │
      │       └── second digit: yield/tensile ratio × 10
      └────────── first digit: tensile strength ÷ 100, in MPa
```

| Class | Tensile (Rm) | Yield strength (Rp0.2) | Typical use |
|---|---|---|---|
| `8.8` | 800 MPa | 640 MPa (0.8 × 800) | The workhorse. Structure, piping, machinery |
| `10.9` | 1000 MPa | 900 MPa | Critical joints, high preload |
| `12.9` | 1200 MPa | 1080 MPa | Machinery, tooling, high strength. Usually socket-head |

Achieved with **carbon or alloy steel, quenched and tempered**. Hence `P-3`: `8.8`, `10.9`, and
`12.9` imply `AC` (carbon steel) — this isn't an assumption, it's the definition of the class.

**American equivalents** (SAE J429, client groups G5 and G6):
- `GRADE 5` ≈ `8.8` (120 ksi ≈ 827 MPa)
- `GRADE 8` ≈ `10.9` (150 ksi ≈ 1034 MPa)

The client's table declares them equivalent. In industry practice they're "commercial equivalents"
—the values aren't identical in MPa— but for specifying and purchasing they're treated as
interchangeable, and that's what `§5` says. It's followed.

Writing note: `GRADO 5` (the Spanish spelling) is also in group G5. The system has to recognize
both.

## 6.3 · Nuts: `8` and `10`, and the case of row 13

ISO 898-2 classifies nuts with **a single digit**, and the criterion is one of pairing: a class-8
nut is manufactured so that, bolted to an 8.8 bolt, **the bolt breaks before the nut does**. That's
the correct design for a joint: you want a visible, predictable failure, not a thread that strips
internally.

| Nut | Mates with | Group |
|---|---|---|
| `8` | `8.8` bolt | G8 |
| `10` | `10.9` bolt | G9 |

That's why `§5` literally says `8` and `10` **only apply to nuts**. They aren't "abbreviated 8.8":
they're a different scale.

**Row 13 of the MTO: `Self-locking nut DIN 985 M12, 8.8, zinc-plated`** (Spanish: `Tuerca
autoblocante DIN 985 M12, 8.8, zincada`).

A nut with a bolt grade. It's planted on purpose. And the temptation —convert `8.8` to `8` because
"that's what they meant"— is exactly the costly error:

- `8.8` is in group **G5**, `8` is in group **G8**. The client's table puts them in different
  groups, so by their own rule **they are not equivalent**.
- Silently changing the specification means buying a nut different from the one the document says,
  without anyone knowing.
- And it isn't obvious what was meant: it could be a typo, it could be that the designer copied the
  bolt's grade from the previous line, or it might genuinely exist in the manufacturer's catalog as
  an improper marking.

`P-6` → `MANUAL_REVIEW` with reason `QUALITY_TYPE_INCOHERENCE`. Let a person decide. The case brief
already points to this by defining `MANUAL_REVIEW` as *"a required attribute is missing **or there
is an inconsistency**."*

Row 11 (`Hex nut DIN 934 M16, A4-80`) is the counter-example: `A4-80` **is** a valid grade for a
stainless nut. The system can't reject every nut grade that isn't `8`/`10`; only the ones that
belong to the steel-bolt scale.

## 6.4 · Stainless: `A2`, `A4`, and the `-70`

Two parts, and each says something different (ISO 3506):

```
      A4   -   70
      │        │
      │        └── strength class: tensile strength in MPa ÷ 10  →  700 MPa
      └─────────── austenitic steel group
```

| Group | AISI/EN | Composition | Corrosion resistance |
|---|---|---|---|
| **A2** | 304 / 1.4301 | ~18% Cr, ~8% Ni | Good overall. Normal environment, indoor, fresh water |
| **A4** | 316 / 1.4401 | ~17% Cr, ~11% Ni, **~2% Mo** | Superior. The **molybdenum** gives it chloride resistance: marine, chemical, and pool environments |

**A4 isn't "an improved A2," it's a different alloy.** The functional difference is the molybdenum,
and that's why A4 is specified in a coastal plant and costs 40–60% more. Specifying A2 where A4 was
needed doesn't fail on delivery day: it fails in two years, with pitting.

Strength suffixes:

| Suffix | Tensile strength | How it's achieved |
|---|---|---|
| *(no suffix)* | — | Only the steel group is specified |
| `-70` | 700 MPa | Cold formed. **The commercial standard** |
| `-80` | 800 MPa | More cold forming. For large sizes or higher load |

The aliases the client's table brings:
- `18-8` → the colloquial American name for 304 (18% chromium, 8% nickel). Group **G1** with `A2`,
  `A2-70`, and `304`.
- `304` / `316` → AISI designation. Groups **G1** and **G3**.

And here it's worth noting a detail in the table: **`A2` and `A2-70` are in the same group (G1),
but `A2-80` is alone in its own (G2)**. In other words, the client considers "A2 with no suffix" and
"A2-70" to be the same thing —because -70 is what's supplied by default— but that -80 is different.
It's a reasonable commercial decision and it has to be implemented as-is, not "fixed."

All groups G1–G4 → material `INOX` in `P-3`.

## 6.5 · ASTM grades: `GR B7`, `GR 2H`

These aren't on the client's list of possible values, and `§5` covers them explicitly: *"if a value
marked as a grade appears that's off the list, it's extracted as-is."*

| Grade | Standard | What it is |
|---|---|---|
| `B7` | ASTM A193 | Chrome-molybdenum alloy steel (AISI 4140 type), quenched and tempered. For high-temperature, high-pressure service. Tensile ≥ 860 MPa |
| `B8` / `B8M` | ASTM A193 | Stainless version: B8 = 304, B8M = 316 |
| `2H` | ASTM A194 | Heavy hex nut, quenched and tempered carbon steel. The B7's mate |
| `L7` | ASTM A320 | Like B7 but for low-temperature (cryogenic) service |

That they're extracted "as-is" means the system does **not** map them to `8.8` or anything else.
They're a different grammar, and the conversion doesn't exist: a B7 isn't a 10.9 even though the
numbers look similar, because what's being specified there is behavior at 400 °C, not just
room-temperature strength.

For `P-3`, `B7` and `2H` → `AC`: both are steels, alloy and carbon respectively. The justification
goes through the standard, not the number.

**The `B8`/`B8M` case is a sleeping trap** that isn't in the 15-row MTO but could be in the blind
set: these are ASTM grades that correspond to **stainless**, not carbon steel. A material derivation
that only looks at "it's ASTM → AC" would get it wrong. The `P-3` table has to go by grade, not by
standard.

## 6.6 · `HV` hardness: why a washer has a "grade"

`HV` = **Vickers hardness**. It's measured by pressing a diamond pyramid in and measuring the
indentation; the number is the load divided by the area. `200HV` means Vickers hardness 200.

It appears on the grade list because **it's how a flat washer is specified**. A washer has no
thread, so it can't have a strength class like `8.8` —which is defined over the tensile behavior of
a thread. What's specified is how much it deforms:

| Class | Typical standard | Use |
|---|---|---|
| `100HV` | ISO 7091, ISO 7094 | Soft washer, coarse grade. General use |
| `140HV` | — | Intermediate |
| `200HV` | ISO 7089, ISO 7090, ISO 7093-1 | **The standard.** This is the normal DIN 125 |
| `300HV` | ISO 7093-2 | Hardened, for 10.9/12.9 fasteners |
| `300HV` / `~380HV` | ASTM F436 | American hardened (38–45 HRC) |

That's why the DIN 125 washer on row 14 with "no grade" is so interesting: in the real catalog,
DIN 125 **implies** 200HV, and a buyer would take it for granted. The written rule doesn't say so,
so the line goes to review (`QUALITY_MISSING`). Once again: the written rule beats industry
practice, and the discrepancy is documented rather than hard-coded.

**`P-8` and the gap in the rule.** `§5` explicitly restricts `8` and `10` to nuts, and says
**nothing** about HV. By the letter of it, an HV `200HV` *bolt* is resolvable. The project's decision
is to resolve it, with this argument: the rules prove they know how to express a per-type
restriction when they want to, so their silence on HV is information, not an oversight. Inventing a
restriction the client didn't write is exactly what `§1` forbids. Switchable with
`POLICY_HV_SCOPE=washer_only`.

## 6.7 · Material derivation table (`P-3`)

The one the system actually applies, with the physical justification for each row:

| Detected grade | Material | Why |
|---|---|---|
| `A2` `A2-70` `A2-80` `18-8` `304` | `INOX` | Austenitic Cr-Ni by definition of the class |
| `A4` `A4-70` `A4-80` `316` | `INOX` | Austenitic Cr-Ni-Mo |
| `8.8` `10.9` `12.9` | `AC` | ISO 898-1 only applies to carbon/alloy steel |
| `GRADE 5` `GRADE 8` `GRADO 5` `GRADO 8` | `AC` | SAE J429, ditto |
| `8` `10` | `AC` | ISO 898-2, ditto |
| `GR B7` `GR 2H` `L7` | `AC` | ASTM A193/A194/A320: alloy or carbon steel |
| `GR B8` `GR B8M` | `INOX` ⚠ | A193 stainless grades. **Not in the MTO; blind-set trap** |
| `100HV` … `300HV` | *not derivable* | Hardness doesn't determine the material. It's left absent |

The last row is the honest one: material can't be derived from `200HV`, because there are 200HV
washers in both carbon steel and stainless. Deriving it would be making it up. The cell is left
absent and the line follows its course under the other rules.

## 6.8 · How a grade is written in the real world

Variants that need to be recognized as the same value:

| Canonical | Also written as |
|---|---|
| `8.8` | `8,8` · `8.8` · `88` · `cl. 8.8` · `class 8.8` · `clase 8.8` · `Grade 8.8` |
| `A4-70` | `A4 70` · `A4/70` · `A470` · `A4-70` · `SS316 A4-70` |
| `316` | `AISI 316` · `SS316` · `1.4401` · `INOX 316` |
| `304` | `AISI 304` · `SS304` · `1.4301` · `18/8` · `18-8` |
| `GR B7` | `GR. B7` · `GRADE B7` · `Gr.B7` · `B7` |
| `200HV` | `200 HV` · `HV200` · `200hv` |
| `GRADE 5` | `GR 5` · `GR.5` · `Grade5` · `GRADO 5` |

The `8,8` with a decimal comma is the one that most often slips through unnoticed: the MTO is written
by a European office and Excel may have converted it to a number. If the cell arrives as a `8.8`
*float*, it's no longer the string the matcher expects.

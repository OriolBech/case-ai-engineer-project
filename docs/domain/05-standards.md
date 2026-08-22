# 5 · Standards

The standard is, in fastener hardware, **the attribute carrying the most information**. The
client's rules say so plainly (`§3`): *"the catalog doesn't distinguish subtypes... what tells
them apart is the standard."* And from there comes policy `P-5`: no standard, nothing to order from
a supplier.

## 5.1 · Who issues each prefix

| Prefix | Body | Scope | Example |
|---|---|---|---|
| **DIN** | *Deutsches Institut für Normung* (Germany) | German standard. Was the de facto European standard until the 90s | `DIN 931` |
| **ISO** | *International Organization for Standardization* | International standard. Progressively replacing DIN | `ISO 4014` |
| **EN** | European Committee for Standardization (CEN) | European standard, mandatory transposition in the EU | `EN 1661` |
| **DIN EN** | DIN adopting an EN | The same standard with a double stamp | `DIN EN 14399` |
| **ASTM** | *American Society for Testing and Materials* | **Material**, not shape: chemical composition and mechanical properties | `ASTM A193` |
| **ASME** | *American Society of Mechanical Engineers* | Dimensions and design of pressure equipment | `ASME B18.2.1` |
| **MSS SP** | *Manufacturers Standardization Society*, *Standard Practice* | Piping complements (supports, fittings) | `MSS SP-58` |
| **SAE** | *Society of Automotive Engineers* | American strength classes (`Grade 5`, `Grade 8`) | `SAE J429` |

**The key conceptual distinction, and the one most likely to trip you up:**

- A **DIN/ISO** standard defines the **shape**: DIN 931 is "partially threaded hex-head bolt," with
  all its dimensions. It doesn't say what material it's made of — that's the grade
  (`8.8`, `A4-70`), which is separate.
- An **ASTM** standard defines the **material**: ASTM A193 is "fastener material for high
  temperature and pressure service," with its composition and heat treatment. It doesn't say what
  shape the piece has — that's an ASME dimensional standard, which in an MTO is almost never
  written because it's taken for granted.

That's why in the metric world the pair is `standard + grade` (`DIN 933` + `8.8`) and in the American
world it's `standard + grade` too (`ASTM A193` + `GR B7`), where the grade is a **subdivision of the
material standard itself**. Two different grammars coexisting in the same file.

## 5.2 · Why DIN 931 "becomes" ISO 4014

This isn't an equivalence the client made up: it's **real standardization history**. Starting in the
90s, Germany began withdrawing (*zurückgezogen*) fastener DINs and replacing them with the
corresponding ISOs, with practically identical geometry. The industry kept — and keeps — saying
"DIN 933" out of habit, but the current standard is ISO 4017.

That's exactly what `§8` of the client's rules says: *"the following are not considered standards
and are normalized to their equivalent."* Translation: **DIN 933 is a historical alias; the
canonical reference is ISO 4017.**

Consequence for the system: DIN→ISO normalization is **not** a style choice — it's what makes two
rows written with different conventions — one `DIN 933`, another `ISO 4017` — end up as the same
material and not get purchased twice.

## 5.3 · The client's table, annotated with what each thing is

The `§8` table, annotated with which piece each standard describes. **It's followed as-is**; the
description column is for understanding, not for deciding.

| DIN | → ISO/EN | What piece it is |
|---|---|---|
| DIN 84 | ISO 1207 | Slotted cheese-head screw |
| DIN 440 | ISO 7094 | Large flat washer for wood (very large outer Ø) |
| DIN 603 | ISO 8677 | Countersunk square-neck bolt (*carriage bolt*) |
| DIN 912 | ISO 4762 | **Socket head cap screw** (internal hex) — row 15 |
| DIN 913 | ISO 4026 | Hex socket set screw, flat point |
| DIN 916 | ISO 4029 | Hex socket set screw, cup point |
| DIN 931 | ISO 4014 | **Hex bolt, partial thread** — rows 2, 6 |
| DIN 933 | ISO 4017 | **Hex bolt, full thread** — rows 3, 4, 10 |
| DIN 934 | ISO 4032 | **Hex nut** — rows 2, 3 (implied), 4, 6, 7, 9, 11 |
| DIN 935 | ISO 7035 | Castle nut (for a cotter pin) |
| DIN 936 | ISO 4035 | Hex thin nut |
| DIN 960 | ISO 8765 | **Fine-pitch** hex bolt, partial thread |
| DIN 961 | ISO 1665 | **Fine-pitch** hex bolt, full thread |
| DIN 963 | ISO 2009 | Slotted countersunk screw |
| DIN 965 | ISO 7046 | Phillips countersunk screw |
| DIN 980 | ISO 7042 | **All-metal** self-locking nut |
| DIN 982 | ISO 7040 | Nylon-insert self-locking nut, **high** |
| DIN 985 | ISO 10511 | Nylon-insert self-locking nut, **low** — row 13 |
| DIN 6923 | EN 1661 | Hex nut with integrated washer (*flange nut*) |
| DIN 7981 C-H | ISO 7049 | Phillips pan-head self-tapping screw |
| DIN 7982 C-H | ISO 7050 | Phillips countersunk self-tapping screw |
| DIN 7985 | ISO 7045 | Phillips pan-head screw |
| DIN 7991 | ISO 10642 | Countersunk socket screw |
| DIN 9021 | ISO 7093 | **Wide flat washer** |
| DIN 125, DIN 125 A | ISO 7089 | **Standard flat washer** — rows 4, 9, 14 |

Reading notes:

- **`DIN 125` and `DIN 125 A` map to the same ISO.** DIN 125 has form A (no chamfer) and form B
  (chamfered); the client collapses both to ISO 7089. It's a simplification **of theirs** and is
  respected as such.
- **`DIN 7981 C-H`**: the `C-H` suffix combines point shape and head shape. You need to match on
  the suffix, not just the number — `DIN 7981` alone is not the same key.
- **`DIN 961 → ISO 1665`** is the assignment the client makes. The usual industry correspondence
  for DIN 961 is ISO 8676. **It is not corrected**: the client's table is the contract
  (`§8`: *"followed as-is"*). It's noted here so whoever sees it doesn't mistake it for a system bug.

## 5.4 · The ones NOT in the table

`§8`, last paragraph: *"a DIN standard not in this table is kept as-is: not all of them have an
equivalent."*

The one that appears in the MTO:

| Standard | What it is | What the system does |
|---|---|---|
| **DIN 975** | Threaded rod, 1 m bar | **Kept** as `DIN 975` (row 9) |
| DIN 976 | Threaded stud, cut to length | Would be kept |
| DIN 6921 | Bolt with integrated washer | Would be kept |
| DIN 6914/6915/6916 | HV structural fasteners (now EN 14399) | Would be kept |

**Code design:** the table is a closed dictionary, and "not in the table" is a normal path, not an
error. A `KeyError` or a fallback to `None` here would be exactly the kind of bug that produces
material with no standard → an unnecessary review.

## 5.5 · The MTO's ASTM world

The three imperial rows (1, 5, 12) live in a different ecosystem. The standards that appear:

| Standard | Grade | What it is | Element |
|---|---|---|---|
| **ASTM A193** | `B7` | Cr-Mo alloy steel (AISI 4140 type), quenched and tempered. For high-temperature, high-pressure fasteners | ESPÁRRAGO |
| **ASTM A194** | `2H` | Heavy hex carbon-steel nut, quenched and tempered. Natural pair to B7 | TUERCA |
| **ASTM F436** | — | Hardened steel washer (through-hardened, ~38–45 HRC) | ARANDELA |

**The A193-B7 / A194-2H / F436 trio is the standard flange set in the oil, gas, and chemical
industry.** It appears together so systematically that a buyer recognizes it as a unit. It's
information the system **cannot** use to invent a missing grade —`§5` is explicit: a missing grade
goes to review — but it does explain why row 1 writes `ASTM F436` with no grade: **F436 has no
grades**, the whole standard is a single specification.

And here's the subtlety that's easy to miss: row 1's washer goes to `REVISION_MANUAL` for
`QUALITY_MISSING` even though, in industry practice, `ASTM F436` **is** its complete
specification. It's a case where the client's written rule and industry practice don't line up.
The rule is respected (the system doesn't invent), and the discrepancy is documented — it's
material for the conversation with the client, not for a hidden `if`.

`GR` = *grade*. Spellings to tolerate: `GR B7` · `GR. B7` · `GRADE B7` · `GR.B7` · `B7` ·
`Gr B7`.

## 5.6 · Standard recognizer: the shape of the problem

```
prefixes       : DIN | DIN EN | EN | ISO | ASTM | ASME | MSS SP | SAE
number         : 1–5 digits, sometimes with a letter or hyphen  (975, 4014, A193, B18.2.1, SP-58)
suffix         : optional, part of the key                     (C-H, A, -1)
separators     : space, none, period                           (DIN931 · DIN 931 · DIN. 931)
```

Cases in the MTO a naive regex gets wrong:

| Actual text | Trap |
|---|---|
| `DIN931` | No space (rows 2, 4, 7) |
| `DIN 931` | With space (rows 3, 6, 9, 10, 13, 14, 15) — **the same file uses both** |
| `ASTM A193, GR B7` | The comma separates standard from grade, and the comma also separates set elements |
| `ASTM A193 GR B7/A194 GR 2H` | Two standards and two grades in one cell, separated by `/` |
| `HEX BOLT M16 x 70` | **No standard.** A valid path, not an exception (`P-5`) |
| `DIN 934 y 2 arandelas DIN 125` | Two standards in the same phrase, each for a different element |

The last one is the truly hard part: **assigning each standard to the correct element** within the
phrase. It's not pattern recognition, it's structural parsing. That's the reason this problem
justifies an LLM and not a regex.

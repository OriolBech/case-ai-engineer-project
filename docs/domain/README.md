# Domain · Industrial fasteners for programmers

This isn't system documentation. It's the **industry knowledge** needed to read
`data/input/MTO_tornilleria.xlsx` and understand *why* it's written the way it is, without ever
having worked in a procurement office for industrial piping.

Written from scratch for someone who knows how to program and doesn't know what a stud bolt is.

## Index

| Doc | What it answers |
|---|---|
| [01-what-is-an-mto.md](01-what-is-an-mto.md) | What is an MTO, where does it come from, who writes it, and why is it messy? |
| [02-excel-anatomy.md](02-excel-anatomy.md) | Cell by cell: the 6 columns, the 15 rows, and each row translated |
| [03-the-five-materials.md](03-the-five-materials.md) | Bolt, nut, washer, stud bolt, threaded rod. What they are and why they go together |
| [04-measures-threads-lengths.md](04-measures-threads-lengths.md) | `M20x90`, `7/8" X 130`: what each number means and why there's no conversion |
| [05-standards.md](05-standards.md) | DIN, ISO, ASTM, ASME, EN, MSS SP. Why DIN 931 "converts" into ISO 4014 |
| [06-qualities.md](06-qualities.md) | `8.8`, `A4-70`, `GR B7`, `200HV`: what a quality grade is and what it tells you about the material |
| [07-finishes.md](07-finishes.md) | Zinc-plating, hot-dip galvanizing, geomet, bluing. Why the finish changes the material |
| [08-glossary.md](08-glossary.md) | All the abbreviations and the EN↔ES vocabulary that appears in MTOs |
| [09-excel-traps.md](09-excel-traps.md) | This file's specific pitfalls, mapped to `P-1…P-9` |

## The 5 minutes, if you read nothing else

1. **An MTO is a shopping list for an industrial construction project.** It's written by
   engineering based on piping drawings. The recipient is a buyer, not a machine: it's written
   in telegraphic prose, mixes languages, and takes for granted everything an experienced buyer
   already knows.

2. **A row in the MTO isn't a single material.** It's often a **bolted assembly** (a bolt +
   its nuts + its washers). Each element is purchased separately, from different suppliers and
   at a different price. That's why 15 rows produce ~40 output lines.

3. **A fastener material is identified by 7 attributes**, and none of them is optional for
   purchasing purposes: type, material, quality, measure, length, standard, and finish. The
   whole point of the case is that the MTO almost never writes all 7.

4. **The column is called `MATERIAL` and doesn't contain the material.** It contains the quality
   (`8.8`, `A4-70`) or the standard with its grade (`ASTM A193 GR B7`). This is the central
   misunderstanding in the file, and it's already flagged in `reglas_tornilleria.md` §4.

5. **Quality is the densest piece of information in the row.** From `8.8` you can deduce it's
   quenched carbon steel at 800 MPa; from `A4-70` that it's 316 stainless with molybdenum; from
   `GR B7` that it's chromium-molybdenum alloy steel for high temperature. That's why `P-3`
   derives the material from the quality: it's the only source available, and it's physically
   correct.

6. **The description is the source of truth; the `MATERIAL` and `MEDIDA` (MEASURE) columns are a
   redundant, and sometimes incomplete, summary** of what the description already says. If they
   disagree, the description wins — and the discrepancy is a signal.

## How this relates to the rest of the documentation

- `data/input/reglas_tornilleria.md` — the client's rules. **It's normative; this isn't.**
- `docs/03-policies.md` — decisions on what the rules leave open (`P-1…P-9`).
- `data/gold/gold.md` — the hand-labeled tag for the 15 rows, line by line.

When this document and the client's rules say different things, **the client wins**. Here we
explain the physics and the practice of the industry; there lies the contract. The places where
the written rule departs from industry practice are explicitly flagged, because those are
exactly the places where the system can get it wrong.

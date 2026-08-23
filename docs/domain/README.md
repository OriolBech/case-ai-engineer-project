# Domain · Industrial fastening for programmers

This is not system documentation. It is the **industry knowledge** needed to read
`data/input/MTO_tornilleria.xlsx` and understand *why* it's written the way it is, without ever
having worked in an industrial piping procurement office.

Written from scratch for someone who knows how to program and doesn't know what a stud bolt is.

## Index

| Doc | What it answers |
|---|---|
| [01-what-is-an-mto.md](01-what-is-an-mto.md) | What is an MTO, where does it come from, who writes it, and why is it messy? |
| [02-excel-anatomy.md](02-excel-anatomy.md) | Cell by cell: the 6 columns, the 15 rows, and each row translated |
| [03-the-five-materials.md](03-the-five-materials.md) | Bolt, nut, washer, stud bolt, threaded rod. What they are and why they go together |
| [04-measures-threads-lengths.md](04-measures-threads-lengths.md) | `M20x90`, `7/8" X 130`: what each number means and why there is no conversion |
| [05-standards.md](05-standards.md) | DIN, ISO, ASTM, ASME, EN, MSS SP. Why DIN 931 "converts" to ISO 4014 |
| [06-qualities.md](06-qualities.md) | `8.8`, `A4-70`, `GR B7`, `200HV`: what a quality grade is and what it tells you about the material |
| [07-finishes.md](07-finishes.md) | Zinc plating, galvanizing, geomet, black oxide. Why the finish changes the material |
| [08-glossary.md](08-glossary.md) | All the abbreviations and the EN↔ES vocabulary that appears in MTOs |
| [09-excel-traps.md](09-excel-traps.md) | The specific traps in this file, mapped to `P-1…P-11` |

## The 5 minutes, if you read nothing else

1. **An MTO is a shopping list for an industrial project.** It's written by engineering from
   piping drawings. The recipient is a buyer, not a machine: it's written in telegraphic prose,
   mixes languages, and takes for granted everything an experienced buyer already knows.

2. **A row in the MTO is not a material.** It is often a **bolted set** (a bolt + its nuts + its
   washers). Each element is purchased separately, from different suppliers and at a different
   price. That's why 15 rows produce ~40 output lines.

3. **A fastening material is identified by 7 attributes**, and none of them is optional for
   purchasing purposes: type, material, quality, size, length, standard, and finish. The charm of
   the case is that the MTO almost never writes all 7.

4. **The column is called `MATERIAL` and does not contain the material.** It contains the quality
   grade (`8.8`, `A4-70`) or the standard with its grade (`ASTM A193 GR B7`). This is the central
   misunderstanding of the file, and it is already flagged in `reglas_tornilleria.md` §4.

5. **The quality grade is the densest piece of information in the row.** From `8.8` you deduce
   it's quenched carbon steel at 800 MPa; from `A4-70` that it's 316 stainless with molybdenum;
   from `GR B7` that it's chromium-molybdenum alloy steel for high temperature. That's why `P-3`
   derives the material from the quality grade: it's the only source available, and it is
   physically correct.

6. **The description is the source of truth; the `MATERIAL` and `MEDIDA` (SIZE) columns are a
   redundant, and sometimes incomplete, summary** of what the description already states. If they
   disagree, the description wins — and the discrepancy is a signal.

## How it relates to the rest of the documentation

- `data/input/reglas_tornilleria.md` — the client's rules. **This is normative; this document is
  not.**
- `docs/03-policies.md` — the decisions on what the rules leave open (`P-1…P-11`).
- `data/gold/gold.md` — the hand-labeled reference for the 15 rows, line by line.

When this document and the client's rules say different things, **the client wins**. This
document explains the physics and the practice of the industry; the rules are the contract. The
places where the written rule departs from industry practice are explicitly flagged, because they
are exactly the places where the system can slip up.

# 1 · What an MTO is

**MTO = Material Take-Off.** Literally "material extraction": the list of all the material needed
to build part of an industrial plant, *extracted* from the drawings.

## Where it comes from

In an industrial project (refinery, chemical plant, paper mill, power plant, shipyard) the flow
is:

```
P&ID  ──▶  Isometrics / piping drawings  ──▶  MTO  ──▶  RFQ  ──▶  Order
(what          (how it's assembled,          (purchase   (request   (purchase)
 exists)        spool by spool, with          list)        for
                every flange and joint)                    quote)
```

- **P&ID** (*Piping & Instrumentation Diagram*): the functional schematic. What equipment exists
  and how it connects.
- **Isometrics**: the shop drawing for each section of pipe (a *spool*). This is where the real
  joints show up: every flange, every valve, every support.
- **MTO**: someone —a drafter or a piping engineer— goes through the isometrics and **counts**. So
  many meters of pipe of a given diameter, so many flanges, so many elbows, and **so many fastener
  sets** to bolt those flanges together.
- **RFQ / order**: procurement turns the MTO into requests for quote and then into orders.

Our system lives in the **MTO ──▶ RFQ** arrow: turning engineering prose into purchasable
references.

## MTO vs. BOM vs. order

These get mixed up a lot, and they aren't the same thing:

| | Who produces it | What it is | Granularity |
|---|---|---|---|
| **MTO** | Engineering / technical office | What the drawing requires | Per spool, line, or area. Descriptive, in prose |
| **BOM** | Engineering / production | Product structure (what makes up what) | Hierarchical, with internal references |
| **Order** | Procurement | What gets bought from a specific supplier | Per SKU, with price and lead time |

The practical difference: a BOM is already normalized (every line is a catalog reference). An
**MTO is not**. An MTO is free text written by whoever is looking at the drawing, and today the
job of normalizing it is done by a person, by hand. That's what's being automated here.

## Why it's so messy

It isn't carelessness. It's a structural consequence:

1. **The recipient is human and an expert.** Whoever writes the MTO knows it's going to be read by
   a buyer with twenty years of experience ordering fasteners. Writing `BOLT DIN931 M20x90 with
   NUT DIN934 M20` is enough *for that person*: they understand the material is steel, that the
   nut carries the same quality, and that if the finish isn't stated it ships bare. Everything
   obvious gets omitted.

2. **It's written once, against the clock.** The MTO comes out during the detailed engineering
   phase, always in a hurry and always with revisions (rev. A, rev. B…). There's no time to
   tabulate 7 attributes per element.

3. **It's multilingual by nature.** International engineering writes in English (`STUD BOLT`,
   `WASHER`, `zinc plated`); the local office writes in Spanish (`Tornillo hexagonal`, `zincado`).
   In the same file. Our MTO has 7 rows in English and 8 in Spanish.

4. **Every firm has its own template.** Columns change from client to client and even from project
   to project. A column named `MATERIAL` can hold the material, the quality, the standard, or a
   mix. In this file it holds the last three cases, never the first.

5. **The text carries industry shorthand.** `LG` is *length*, `W/` is *with*, `c/w` is *complete
   with*, `uds` is *unidades* [units]. None of these are defined anywhere in the file: they're
   assumed to be common knowledge.

## What "fasteners" means and why it's a family of its own

In industrial procurement jargon, **tornillería** (in English, *fasteners* or *bolting*) is the
family of bolted-joint elements. It has three characteristics that make it a particularly
unforgiving case:

- **High volume, low unit value.** Thousands of pieces, cents per piece. Nobody is going to spend
  an hour normalizing a €40 line.
- **But an error that hits the site.** If grade-8 nuts arrive where grade-10 was needed, or
  zinc-plated ones where hot-dip galvanized was needed, the joint doesn't meet spec and assembly
  stops. The cost of the error isn't the price of the part: it's the day of downtime.
- **Bought as assemblies, invoiced as individual pieces.** One drawing line ("one flanged joint")
  is five different materials. That unpacking is the part of the work most prone to human error.

That's why it's the natural candidate for automating first: high mechanical volume, bounded
judgment calls, and a clear consequence when it fails.

## The minimal vocabulary of a flanged joint

Almost all the fasteners in a piping MTO exist to bolt **flanges** together. It helps to have the
picture in mind:

```
        pipe ═══════╗                    ╔═══════ pipe
                    ║                    ║
              ┌─────╫─────┐        ┌─────╫─────┐
              │ FLANGE A  │ gasket │ FLANGE B  │
              └──┬──┬──┬──┘   │    └──┬──┬──┬──┘
                 │  │  │      │       │  │  │
       nut ▸ ○───┼──┼──┼──────┴───────┼──┼──┼───○ ◂ nut
    washer ▸ ▭  │  │  │              │  │  │  ▭ ◂ washer
                 └══╧══╧══════════════╧══╧══┘
                        ▲ STUD (rod threaded at both ends)
```

Two flanges, a gasket between them, and N studs around the circle. **Each stud carries 2 nuts and
2 washers** (one of each per side). That's why in row 1 of the MTO, 40 studs carry 80 nuts and 80
washers: the multiplicity isn't arbitrary, it's geometry.

This is the physical basis for policy `P-2` (implicit multiplicity): when the MTO doesn't state
how many nuts go on, the default answer for a stud is **2**, because that's how a flange is
assembled.

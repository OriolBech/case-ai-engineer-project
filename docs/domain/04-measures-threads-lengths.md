# 4 · Sizes, threads, and lengths

The three numeric fields (`medida`/size, `longitud`/length, and the implicit thread) are where
it's easiest to write a regex that works for the 15 rows and fails on row 16.

## 4.1 · The two systems

They coexist in the same file and **don't convert into one another** (`§6`, `§7`).

| | Metric (ISO/DIN) | Imperial (ASTM/ASME) |
|---|---|---|
| Size | `M20` = Ø nominal 20 mm | `7/8"` = Ø nominal 7/8 inch |
| Length | mm | inches… or mm (see 4.4) |
| Thread | pitch in mm | threads per inch (TPI) |
| World | Europe, general industry | North America, pressure piping |
| In the MTO | 12 rows | 3 rows (1, 5, 12) |

**Why there's no equivalence**, and the rule is so categorical. `M22` = 22.00 mm. `7/8"` =
22.225 mm. They differ by 0.2 mm — which means nothing for a diameter and **changes everything
for a thread**: the profiles, pitches, and tolerances are incompatible. An M22 nut doesn't fit an
7/8" stud, and if forced on, the joint wouldn't hold. Converting means misspecifying.

The practical consequence: when the system finds `7/8"`, it looks **only** in imperial. Not
"22 mm or similar." There's no *fuzzy match* between systems. Ever.

## 4.2 · How `M20x90` is read

```
   M      20       x      90
   │      │               │
   │      │               └── LENGTH in mm
   │      └────────────────── SIZE: nominal diameter in mm
   └───────────────────────── ISO metric system
```

The thread pitch **isn't written** when it's the coarse pitch, which is the default case. It's
known from a table:

| Size | Coarse pitch | Wrench |
|---|---|---|
| M8 | 1.25 mm | 13 |
| M10 | 1.50 mm | 17 |
| M12 | 1.75 mm | 19 |
| M16 | 2.00 mm | 24 |
| M20 | 2.50 mm | 30 |
| M24 | 3.00 mm | 36 |

If the MTO wrote `M20x1,5x90` it would be **fine pitch** — a different material, and a different
standard (DIN 960/961 instead of 931/933). It doesn't appear in this file, but the client's
equivalence table includes DIN 960 and DIN 961, which means the client **expects** fine pitch to
show up at some point. A regex that assumes `M(\d+)x(\d+)` parses it wrong silently.

Writing variants of the same data that must be tolerated:
`M20x90` · `M20 x 90` · `M 20 X 90` · `M20-90` · `M20*90` · `Ø20x90`

## 4.3 · How `7/8" X 130 LG` is read

```
   7/8"        X      130      LG
   │                  │        │
   │                  │        └── "LG" = length, marks the number as the length
   │                  └─────────── LENGTH, no unit ⚠
   └────────────────────────────── SIZE: fraction of an inch
```

Imperial sizes are written **as fractions**, not decimals: `1/4"`, `5/16"`, `3/8"`, `1/2"`,
`5/8"`, `3/4"`, `7/8"`, `1"`, `1-1/8"`, `1-1/4"`. A naive numeric parser trips on two things:

- `7/8` can be mistaken for a date or a division. It has to be captured as a token.
- `1-1/8"` is **one and one eighth** (28.58 mm), not "1 minus 1/8." The hyphen is a separator for
  the whole part, not a minus sign.

The imperial thread isn't written either: `7/8"` in structural bolting is `7/8"-9 UNC` (9 threads
per inch, unified coarse thread). The fine alternative is UNF. In the ASME B16.5 flange world it's
UNC up to 1" and 8UN above that.

Equivalent notations: `7/8"` · `7/8 IN` · `7/8 INCH` · `0.875"` (rare but it exists) ·
`Ø7/8"`.

## 4.4 · Length without a unit (`P-4`)

Three MTO rows (1, 5, 12) write the length **without a unit**:

| Row | Text | If it's mm | If it's inches |
|---|---|---|---|
| 1 | `7/8" X 130 LG` | 130 mm = 5.1" | 130" = 3.30 m |
| 5 | `1" X 150 LG` | 150 mm = 5.9" | 150" = 3.81 m |
| 12 | `3/4" X 110 LG` | 110 mm = 4.3" | 110" = 2.79 m |

The second column is an ordinary flange stud. The third is a three-meter bar that doesn't exist as
a stud. **That's why `P-4` decides `mm` using a physical plausibility range**, and not by "what's
most common."

The ranges come from the geometry of the joint: a flange stud runs roughly 4 to 12 times its
diameter. Outside that range, the line goes to review (`LENGTH_UNIT_IMPLAUSIBLE`) instead of being
resolved incorrectly. The rule is defensible to the client because it doesn't rest on a
preference, it rests on the other option being physically impossible.

**Mixed units within the same row.** Watch out for how odd it sounds and how normal it actually
is: size in inches (`7/8"`) and length in millimeters (`130`). This is common practice in
European engineering purchasing American material — the size is from the ASTM catalog, the length
is calculated by the designer in whatever system they work in. It isn't an MTO error.

## 4.5 · When length doesn't apply

`§7`: *"required field for all fasteners except nuts and washers."*

| Type | Length? | Why |
|---|---|---|
| BOLT | **required** | Determines the grip. It's half the reference |
| STUD | **required** | Made to order |
| THREADED ROD | **required** | Sold by the bar or cut to length |
| NUT | not applicable | Has a *height*, and the standard fixes it for each size |
| WASHER | not applicable | Has a *thickness*, and the standard fixes it |

**A distinction that matters in the data model:** "not applicable" ≠ "absent." A nut with no
length is complete; a bolt with no length is incomplete. In the gold set these are
`{"value":"N/A","provenance":"not_applicable"}` and `{"value":null,"provenance":"absent"}`
respectively. If the system collapses them both to `null`, it loses the ability to tell a missing
datum apart from a nonexistent one — and that's the difference between `REVISION_MANUAL` and
`RESUELTA`.

## 4.6 · Size extrapolation within a set (`§2`)

**The only extrapolation the client's rules authorize.** When a row describes a set and only one
of the elements carries a size, that size propagates to the rest:

```
Row 4:  BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125
                     ▲                  ▲               ▲
                  M16 written      no size          no size
                     │                  │               │
                     └──────────────────┴───────────────┘
                     authorized extrapolation → M16, M16
```

It's physics: the nut for an M16 bolt is M16 by definition, there's no other option. That's why
the client authorizes it and authorizes nothing else.

**And only the size.** The test case is row 7 (`BOLT ... A4-70 with NUT ... A4-80`): if quality
were extrapolated, the nut would come out as `A4-70` when the MTO says `A4-80`. Two different
equivalence groups (G3 vs. G4), two different materials, a silent specification error.

**Watch out for extrapolating when it's already written.** In row 1 the nut **does** carry its own
size (`HEX. NUT 7/8"`). Marking it as extrapolated would lose traceability: the gold set labels it
`extracted`, not `extrapolated`. Extrapolation is a last resort, not a shortcut.

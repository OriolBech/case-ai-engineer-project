# 7 · Finishes

Finish is the piece's **surface coating**. It exists for one purpose only: so it doesn't rust.
And it has a property that makes it special among the seven attributes:

> **A zinc-plated bolt and the same bolt with no finish are two different materials** (`§9`).

It isn't a variant or an ordering option: it's a different reference, a different price, sometimes
a different supplier. That's why finish can't be treated lightly, and why `P-1` (does a finish
written once cover the whole set?) is the most delicate policy in the project.

## 7.1 · The seven catalog values

| Normalized value | What it is | Typical thickness | Protection | Cost |
|---|---|---|---|---|
| `CINCADO` (zinc plating) | Electrolytic zinc. The piece is bathed in a zinc salt with current applied | 5–12 µm | Low–medium. Indoor, dry environment | +5% |
| `BICROMATADO` (yellow zinc / chromate) | Zinc plating + yellow passivation (chromates) | 8–15 µm | Medium. Visually distinctive: iridescent yellow | +8% |
| `GALVANIZADO EN CALIENTE` (hot-dip galvanizing) | The piece is dipped in molten zinc at ~450 °C | **45–85 µm** | **High.** Outdoor, decades | +25–40% |
| `GEOMET` | Zinc + aluminum flake coating in a water base, no hexavalent chromium. Trade name (NOF Metal Coatings) | 5–10 µm | High, at low thickness. No embrittlement | +30% |
| `DACROMET` | Predecessor to Geomet, **with hexavalent chromium** | 5–10 µm | High | +30% |
| `FOSFATADO` (phosphating) | Chemical conversion (zinc or manganese phosphate) + oil | 2–10 µm | **Low.** It's a paint or anti-galling base | +3% |
| `PAVONADO` (black oxide) | Black oxide. Chemical conversion giving a black color | <1 µm | **Nearly none** without oil | +2% |

## 7.2 · Why hot-dip galvanizing is a special case

It's the only finish with a **dimensional consequence**. 45–85 µm of zinc is so much that the
thread no longer fits: the nut for a hot-dip-galvanized joint has to be **over-tapped**, i.e.,
manufactured with a wider internal thread on purpose (ISO 10684).

Consequences a developer needs to know:

1. **An HDG nut is not a regular nut that's been galvanized.** It's a different product, with the
   thread machined after the bath. If the system resolves "DIN 934 nut + HDG finish" as if it were
   composable, it produces a part number no supplier can actually fulfill as such.
2. **It reinforces `P-1`.** In a hot-dip-galvanized set, extrapolating the finish to the nut is
   *physically mandatory*: a non-galvanized nut doesn't fit a galvanized bolt, and a galvanized one
   that isn't over-tapped doesn't either. The mixed set doesn't exist.
3. **It doesn't apply to high strength.** The 450 °C bath would temper back a 10.9 or 12.9 bolt and
   drop its class. That's why HDG goes with 8.8 or lower.

## 7.3 · Why `12.9` goes with `geomet` and not `cincado` (zinc plating) (row 15)

It's the nicest detail in the MTO, and it's no coincidence.

Electrolytic zinc plating is an **acidic process that releases hydrogen**. In high-strength steels
(above ~1000 MPa, i.e., `10.9` and especially `12.9`), atomic hydrogen penetrates the crystal
lattice and causes **hydrogen embrittlement**: the bolt becomes brittle and can fail cold, with no
abnormal load, days or weeks after installation. It's a delayed, catastrophic failure.

It can be mitigated with a bake-out (oven at 200 °C for hours), but standard practice is to
**avoid the electrolytic process altogether**: for 12.9, a zinc-flake coating is used
(Geomet, Delta-Protekt, Magni), applied and cured without an acid bath and without hydrogen.

That's why `Tornillo Allen cilindrico DIN 912 M10 x 40, 12.9, geomet` is a line written by someone
who knows what they're doing. And that's why a `12.9, zincado` line would be a **technical
incoherence** — it isn't in the client's rules, so the system doesn't flag it today, but it's a
natural candidate for a future coherence rule and deserves flagging. It's in the same family as
`P-6`.

## 7.4 · The client's normalization table, and where the aliases come from

`§9` of the rules. Annotated here with the reason for each alias — which is what lets you recognize
the ones not on the list.

| Detected | → Normalized | Where the alias comes from |
|---|---|---|
| `GEOMET` | `GEOMET` | Trade name |
| `DACROMET` | `DACROMET` | Trade name |
| `GALVANIZADO EN CALIENTE`, `HOT DIP GALVANIZED`, `GALVA`, `HDG` | `GALVANIZADO EN CALIENTE` | `HDG` = *hot dip galvanized*. `GALVA` = site slang |
| `CINCADO`, `ZINCADO`, `ZN`, `ZP`, `ZINC PLATED` | `CINCADO` | `ZN` = zinc symbol. `ZP` = *zinc plated*. "Cincado"/"zincado" are the same word spelled differently |
| `PAVONADO`, `BL`, `NEGRO` | `PAVONADO` | `BL` = *black*. "Pavonado" is the Spanish textbook term |
| `FOSFATADO`, `PHOSPHATED` | `FOSFATADO` | — |
| `BICROMATADO`, `YZP`, `YELLOW ZINC PLATED` | `BICROMATADO` | `YZP` = *yellow zinc plated*, for the yellow color of the passivation |

**Aliases the table doesn't cover** that show up in real MTOs — worth keeping on the radar for the
blind set: `HDZ`, `HOT-DIP`, `GALV.`, `SHERARDIZED`, `ZINC FLAKE`, `DELTA-PROTEKT`,
`MAGNI`, `BLACK OXIDE`, `SELF-COLOUR`, `PLAIN` (= no finish, it is NOT a finish!),
`AS ROLLED`, `BRUÑIDO`, `NIQUELADO`, `PTFE`, `XYLAN`.

Two of these are especially treacherous:
- **`PLAIN`** and **`SELF-COLOUR`** mean *no coating*. If the system normalizes them to some finish,
  it creates a material that isn't real. The correct behavior is a blank finish.
- **`ZINC FLAKE`** is the generic category Geomet and Dacromet both belong to. Without a brand, you
  can't decide which of the two: it's a review candidate, not a "pick the most likely one" case.

## 7.5 · Blank is a valid value

`§9` is explicit: *"most often it isn't stated, and then it's left blank. Blank is a valid value
and does **not** send the line to review."*

This contrasts directly with grade, whose absence **does** send the line to review (`§5`). It's the
asymmetry worth memorizing:

| Missing attribute | Consequence |
|---|---|
| Finish | `RESUELTA`, blank finish |
| Grade | `REVISION_MANUAL` (`§5`) |
| Standard | `REVISION_MANUAL` by our own decision (`P-5`) |
| Material | `RESUELTA` with derived material (`P-3`) |
| Length, for bolt/stud/rod | A mandatory field is missing (`§7`) |
| Length, for nut/washer | Not applicable, `RESUELTA` |

And it makes physical sense: a bolt with no finish **exists** and gets bought every day (bare
steel). A bolt with no grade doesn't exist: every manufactured piece has a strength class, and if
the document doesn't write it, information is missing — the piece isn't lacking it.

## 7.6 · The `P-1` problem, in one picture

```
Fila 4:  BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated
                                                                    ▲
                                                          ¿a quién alcanza?

Opción A — alcanza a todo el set                Opción B — sólo al principal
  TORNILLO M16x60 8.8 CINCADO                     TORNILLO M16x60 8.8 CINCADO
  TUERCA   M16    8.8 CINCADO                     TUERCA   M16    8.8 (crudo)
  ARANDELA M16    8.8 CINCADO                     ARANDELA M16    8.8 (crudo)

  ⚠ contradice §2: sólo la medida               ⚠ set físicamente inconsistente
    se extrapola                                   y no comprable como conjunto
```

Both options are bad, and that's the point: there's no correct answer within the written rules.
**That's why the client was asked** (Q1) instead of deciding it silently. The default is
option A — finish is a specification of the functional assembly, and a mixed set can't be
installed — with `provenance: "extrapolated"` so it's visible as a decision and not a data point,
and switchable via `POLICY_FINISH_SET_SCOPE`.

It affects 4 of 15 rows: **4, 6, 8, 9**. 26% of the file depends on a decision the rules don't
contain. That number is the argument for why the question was worth a slot.

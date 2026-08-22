# Gold set · 15-row MTO

> Hand-labeled on 2026-08-21, **before the pipeline existed**. 15 rows → **30 output lines**.
> Machine format in `gold.jsonl`, statistics in `gold.stats.json`.

## How to read the tables

| Mark | Meaning |
|---|---|
| `—` | The attribute **is not** in the MTO |
| `N/A` | Not applicable: length on a nut or washer (§7) |
| **bold** | Cell **dependent on policy** (P-1…P-9), not deducible from the rules |
| ᵘ | Quality grade marked as such but outside the catalog (ASTM grades) |
| ᵉ | Extrapolated within the set |
| ᵈ | Material derived from the quality grade (P-3) |
| ⁱ | Inferred: unwritten multiplicity (P-2) or **imperial** length without unit (P-4) |

Note on length: `M20x90` is a metric ISO designation and the 90 is unambiguously millimeters —
that's not a policy, it's reading the standard. Only the imperial case (`7/8" X 130`) remains
open, and that's 3 cells out of the 30.

Everything not in bold is deduced from `reglas_tornilleria.md` or the case statement. It's the
part of the gold set the KPI is computed on; the bold cells are reported separately as a
sensitivity analysis, because a KPI that mixes both is not defensible in front of a client.

---

## Row 1 — 3 lines · 2 resolved, 1 to review

```
STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L001` | ESPARRAGO | **AC ᵈ** | GR B7 ᵘ | 7/8" | **130 mm ⁱ** | ASTM A193 | — | 40 | ✅ RESUELTA |
| `L002` | TUERCA | **AC ᵈ** | GR 2H ᵘ | 7/8" | N/A | ASTM A194 | — | 80 | ✅ RESUELTA |
| `L003` | ARANDELA | — | — | 7/8" | N/A | ASTM F436 | — | 80 | ⚠️ QUALITY_MISSING |

- `L002` — size written for the nut ('HEX. NUT 7/8"'), not extrapolated
- `L003` — the §2 example emits the washer with quality '--'; the PDF says an element without a
  quality goes to review. P-7: the system sends to review, the person decides

## Row 2 — 2 lines · 1 resolved, 1 to review

```
BOLT DIN931 M20x90 with NUT DIN934 M20
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L004` | TORNILLO | **INOX ᵈ** | A4-70 | M20 | 90 mm | ISO 4014 | — | 160 | ✅ RESUELTA |
| `L005` | TUERCA | — | — | M20 | N/A | ISO 4032 | — | **160 ⁱ** | ⚠️ QUALITY_MISSING |

- `L005` — the A4-70 in the MATERIAL column belongs to the principal element: row 7 proves it
  (bolt A4-70 / nut A4-80). Quality grade is not extrapolated

## Row 3 — 3 lines · 1 resolved, 2 to review

```
Tornillo hexagonal DIN 933 M12 x 50 con tuerca y arandela
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L006` | TORNILLO | **INOX ᵈ** | A2 | M12 | 50 mm | ISO 4017 | — | 80 | ✅ RESUELTA |
| `L007` | TUERCA | — | — | M12 ᵉ | N/A | — | — | **80 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING |
| `L008` | ARANDELA | — | — | M12 ᵉ | N/A | — | — | **80 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING |

## Row 4 — 3 lines · 1 resolved, 2 to review

```
BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L009` | TORNILLO | **AC ᵈ** | 8.8 | M16 | 60 mm | ISO 4017 | CINCADO | 100 | ✅ RESUELTA |
| `L010` | TUERCA | — | — | M16 ᵉ | N/A | ISO 4032 | **CINCADO ᵉ** | **100 ⁱ** | ⚠️ QUALITY_MISSING |
| `L011` | ARANDELA | — | — | M16 ᵉ | N/A | ISO 7089 | **CINCADO ᵉ** | **100 ⁱ** | ⚠️ QUALITY_MISSING |

- `L010` — robust to the policy: if the 8.8 were extrapolated to the nut it would be an
  INCOHERENCE (P-6) and would go to review anyway

## Row 5 — 3 lines · 2 resolved, 1 to review

```
STUD BOLT 1" X 150 LG, ASTM A193, GR B7, W/ 2 NUT ASTM A194, GR 2H, 1 WASHER ASTM F436
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L012` | ESPARRAGO | **AC ᵈ** | GR B7 ᵘ | 1" | **150 mm ⁱ** | ASTM A193 | — | 24 | ✅ RESUELTA |
| `L013` | TUERCA | **AC ᵈ** | GR 2H ᵘ | 1" ᵉ | N/A | ASTM A194 | — | 48 | ✅ RESUELTA |
| `L014` | ARANDELA | — | — | 1" ᵉ | N/A | ASTM F436 | — | 24 | ⚠️ QUALITY_MISSING |

- `L013` — 'W/ 2 NUT' -> 24x2
- `L014` — '1 WASHER' -> 24x1

## Row 6 — 2 lines · 1 resolved, 1 to review

```
Tornillo DIN 931 M16 x 80 con tuerca DIN 934, 8.8, zincado
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L015` | TORNILLO | **AC ᵈ** | 8.8 | M16 | 80 mm | ISO 4014 | CINCADO | 60 | ✅ RESUELTA |
| `L016` | TUERCA | — | — | M16 ᵉ | N/A | ISO 4032 | **CINCADO ᵉ** | **60 ⁱ** | ⚠️ QUALITY_MISSING |

## Row 7 — 2 lines · 2 resolved, 0 to review

```
BOLT DIN931 M12x60 A4-70 with NUT DIN934 M12 A4-80
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L017` | TORNILLO | **INOX ᵈ** | A4-70 | M12 | 60 mm | ISO 4014 | — | 50 | ✅ RESUELTA |
| `L018` | TUERCA | **INOX ᵈ** | A4-80 | M12 | N/A | ISO 4032 | — | **50 ⁱ** | ✅ RESUELTA |

- `L018` — A4-80 (G4) on a nut is coherent. It's the row that proves quality grade is NOT
  extrapolated

## Row 8 — 3 lines · 0 resolved, 3 to review

```
HEX BOLT M16 x 70 c/w NUT AND WASHER, 8.8, ZN
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L019` | TORNILLO | **AC ᵈ** | 8.8 | M16 | 70 mm | — | CINCADO | 75 | ⚠️ STANDARD_MISSING |
| `L020` | TUERCA | — | — | M16 ᵉ | N/A | — | **CINCADO ᵉ** | **75 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING |
| `L021` | ARANDELA | — | — | M16 ᵉ | N/A | — | **CINCADO ᵉ** | **75 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING |

- `L019` — the only line that goes to review SOLELY for lack of standard (P-5)

## Row 9 — 3 lines · 1 resolved, 2 to review

```
Conjunto esparrago M20 x 200 DIN 975 con 2 tuercas DIN 934 y 2 arandelas DIN 125, 8.8, zincado
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L022` | ESPARRAGO | **AC ᵈ** | 8.8 | M20 | 200 mm | DIN 975 | CINCADO | 30 | ✅ RESUELTA |
| `L023` | TUERCA | — | — | M20 ᵉ | N/A | ISO 4032 | **CINCADO ᵉ** | 60 | ⚠️ QUALITY_MISSING |
| `L024` | ARANDELA | — | — | M20 ᵉ | N/A | ISO 7089 | **CINCADO ᵉ** | 60 | ⚠️ QUALITY_MISSING |

- `L022` — DIN 975 isn't in the table of 25: kept as-is (§8)

## Row 10 — 1 line · 1 resolved, 0 to review

```
Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L025` | TORNILLO | **AC ᵈ** | 8.8 | M10 | 40 mm | ISO 4017 | CINCADO | 500 | ✅ RESUELTA |

## Row 11 — 1 line · 1 resolved, 0 to review

```
Tuerca hexagonal DIN 934 M16, A4-80
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L026` | TUERCA | **INOX ᵈ** | A4-80 | M16 | N/A | ISO 4032 | — | 200 | ✅ RESUELTA |

## Row 12 — 1 line · 1 resolved, 0 to review

```
STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L027` | ESPARRAGO | **AC ᵈ** | GR B7 ᵘ | 3/4" | **110 mm ⁱ** | ASTM A193 | — | 40 | ✅ RESUELTA |

- `L027` — doesn't mention nuts -> a SINGLE line. A set is not completed by convention

## Row 13 — 1 line · 0 resolved, 1 to review

```
Tuerca autoblocante DIN 985 M12, 8.8, zincada
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L028` | TUERCA | **AC ᵈ** | 8.8 | M12 | N/A | ISO 10511 | CINCADO | 300 | ⚠️ QUALITY_TYPE_INCOHERENCE |

- `L028` — 8.8 (G5) on a nut. NEVER converted to 8 (G8): different groups

## Row 14 — 1 line · 0 resolved, 1 to review

```
Arandela plana DIN 125 M10, acero, zincada
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L029` | ARANDELA | AC | — | M10 | N/A | ISO 7089 | CINCADO | 250 | ⚠️ QUALITY_MISSING |

- `L029` — the only row of the MTO with a REAL material written ('acero' — steel). And it's
  exactly the one that has no quality grade

## Row 15 — 1 line · 1 resolved, 0 to review

```
Tornillo Allen cilindrico DIN 912 M10 x 40, 12.9, geomet
```

| | Name | Material | Quality | Size | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L030` | TORNILLO | **AC ᵈ** | 12.9 | M10 | 40 mm | ISO 4762 | GEOMET | 120 | ✅ RESUELTA |
---

# What the gold set says

## 1. This MTO's autonomy ceiling is 50%, and it's not the system's fault

| | |
|---|---|
| Input rows | 15 |
| Output lines | **30** |
| `RESUELTA` | **15 (50%)** |
| `REVISION_MANUAL` | **15 (50%)** |

The breakdown of why lines go to review is the important finding:

| Reason | Lines |
|---|---|
| `QUALITY_MISSING` | **13** — and **12 are the secondary element of a set** |
| `STANDARD_MISSING` | 5 (overlaps with the previous one in 4) |
| `QUALITY_TYPE_INCOHERENCE` | 1 (row 13) |

**87% of the review queue is one single thing: the MTO doesn't write the quality grade for the
nuts and washers of a set.** That's `MISSING_IN_SOURCE`, not `LOW_CONFIDENCE`: no model fixes it,
however good it is. It has to go back to engineering.

This **reframes the commitment to the client**. The promise can't be "I resolve 90% of the
lines," because with this data that's impossible, and promising it means promising to invent data.
The promise is:

> I resolve virtually everything that's resolvable with the data engineering provides, and I give
> you the exact, actionable list of what engineering has to fix so the rest becomes resolvable.

The second half has value of its own: today nobody knows that 12 out of every 30 fastening lines
are unresolvable at the source, because nobody has ever measured it.

## 2. 87% of the gold set is deducible from the rules

| | Cells | % |
|---|---|---|
| Certain (deducible from the rules or the case statement) | 183 | **87%** |
| Policy-dependent | 27 | 13% |

Breakdown of the 27: **material 17** (P-3), **finish 7** (P-1), **imperial length 3** (P-4). Plus
9 of the 30 quantity cells (P-2).

The KPI is computed on the 183 certain ones. The 27 are reported as sensitivity.

## 3. Sensitivity analysis: no single policy dominates

| Alternative policy | Autonomy | Δ |
|---|---|---|
| **Base** (P-1…P-9 per `../../docs/03-policies.md`) | **15/30 (50%)** | — |
| P-4 = `review` (unwritten imperial length blocks) | 12/30 (40%) | −3 |
| P-2 = `review` (unwritten multiplicity blocks) | 14/30 (47%) | −1 |
| P-1 = `principal_only` (finish only to the principal) | 15/30 (50%) | 0 |
| P-3 = `off` (empty material, doesn't block) | 15/30 (50%) | 0 |
| P-5 = `resolve` (missing standard doesn't block) | 16/30 (53%) | +1 |
| P-6 = `ignore` (quality/type incoherence doesn't block) | 16/30 (53%) | +1 |

**No policy moves more than 3 lines out of 30.** That's good news, and it wasn't obvious: it means
the number committed to the client doesn't hang on a debatable policy decision, but on the
structure of the data itself. It's what makes asking only two questions defensible.

Correction to an earlier version of this analysis: it counted metric lengths as policy-dependent
and gave P-4 an impact of −11. That's incorrect: `M20x90` is an ISO designation and the 90 is
unambiguously millimeters. Only the three imperial rows (1, 5, 12) depend on P-4.

Two findings that take weight off decisions that seemed big:

- **P-1 doesn't move autonomy at all.** The extrapolated finish always falls on lines that are
  already in review for a missing quality grade. It still matters —it determines which material
  gets bought when the person resolves the review— but it can't be calibrated with this sample,
  nor will it be seen failing in the demo. That's exactly the argument used to justify asking
  about it.
- **Row 4 is robust to the policy**: if the `8.8` were extrapolated to the nut it would be an
  incoherence (P-6) and the line would go to review either way. It goes to review through both
  paths.

## 4. Labeling decisions that need to be defensible

1. **The value in the `MATERIAL` column belongs to the principal element, not to the row.** The
   proof is in row 7: the column says `A4-70` and the description explicitly gives `A4-80` to the
   nut. If the column's value belonged to the row, row 7 would contradict itself. This is where 8
   of the 15 lines to review come from.
2. **A quality grade written once at the end of a row describing a set is not extrapolated.** Rows
   4, 6, 8, and 9 have this shape. Syntactically it looks like a row-level attribute; the rules say
   quality grade is not extrapolated. It's the rule the case statement calls "the one that costs
   the most," and where a careless system slips toward the costly error.
3. **Row 1: the nut's size is written** (`HEX. NUT 7/8"`), not extrapolated. In row 5 it is
   extrapolated (`2 NUT ASTM A194`, no size). This changes the provenance and, with it, the
   confidence.
4. **Row 12 is a single line.** It describes a stud, doesn't mention nuts, and a set isn't
   completed by convention.
5. **Row 14 is the only one with a real material** (`acero` — steel, provenance `extracted`, not
   `derived`), and it's exactly the one missing a quality grade.
6. **Row 13: `8.8` on a nut is never converted to `8`.** G5 and G8 are different groups.
   Converting would mean silently changing the specification: the 3-to-8-week error.

## 5. What this gold set is NOT

- **It hasn't been validated by a second pass.** The blind double pass gives the lower bound of
  the human error rate that the case statement says no one has ever measured. Pending.
- **It hasn't been reviewed by a buyer.** It's an engineer's interpretation of the rules, not
  someone with twenty years of experience buying bolts. This needs to be said before they say it.
- **It's 30 lines.** Enough to steer development and catch regressions; not enough for a tight
  confidence interval. That's why the 64 targeted synthetic rows exist, and why the commitment is
  argued through the cost of the two errors rather than through this percentage.

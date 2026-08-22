# Gold set · 15-row MTO

> Hand-labeled on 2026-08-21, **before the pipeline exists**. 15 rows → **30 output lines**.
> Machine format in `gold.jsonl`, statistics in `gold.stats.json`.

## How to read the tables

| Mark | Meaning |
|---|---|
| `—` | The attribute **is not** in the MTO |
| `N/A` | Not applicable: length on a nut or washer (§7) |
| **bold** | **Policy-dependent** cell (P-1…P-9), not deducible from the rules |
| ᵘ | Quality grade marked as such but outside the catalog (ASTM grades) |
| ᵉ | Extrapolated within the set |
| ᵈ | Material derived from the quality grade (P-3) |
| ⁱ | Inferred: length unit (P-4) or multiplicity (P-2) |

Everything not in bold is deduced from `reglas_tornilleria.md` or from the brief. This is the part
of the gold set the KPI is calculated on; the bold cells are reported separately as sensitivity
analysis, because a KPI that mixes the two isn't defensible in front of a client.

---

## Row 1 — 3 lines · 2 resolved, 1 to review

```
STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L001` | ESPARRAGO | **AC ᵈ** | GR B7 ᵘ | 7/8" | **130 mm ⁱ** | ASTM A193 | — | 40 | ✅ RESOLVED |
| `L002` | TUERCA | **AC ᵈ** | GR 2H ᵘ | 7/8" | N/A | ASTM A194 | — | 80 | ✅ RESOLVED |
| `L003` | ARANDELA | — | — | 7/8" | N/A | ASTM F436 | — | 80 | ⚠️ QUALITY_MISSING |

- `L002` — measure written explicitly for the nut ('HEX. NUT 7/8"'), not extrapolated
- `L003` — the §2 example emits the washer with quality '--'; the PDF says an element without a quality grade goes to review. P-7: the system sends it to review, the person decides

## Row 2 — 2 lines · 1 resolved, 1 to review

```
BOLT DIN931 M20x90 with NUT DIN934 M20
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L004` | TORNILLO | **INOX ᵈ** | A4-70 | M20 | 90 mm | ISO 4014 | — | 160 | ✅ RESOLVED |
| `L005` | TUERCA | — | — | M20 | N/A | ISO 4032 | — | **160 ⁱ** | ⚠️ QUALITY_MISSING |

- `L005` — the A4-70 in the MATERIAL column belongs to the primary element: row 7 proves this (A4-70 bolt / A4-80 nut). Quality is not extrapolated

## Row 3 — 3 lines · 1 resolved, 2 to review

```
Tornillo hexagonal DIN 933 M12 x 50 con tuerca y arandela
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L006` | TORNILLO | **INOX ᵈ** | A2 | M12 | 50 mm | ISO 4017 | — | 80 | ✅ RESOLVED |
| `L007` | TUERCA | — | — | M12 ᵉ | N/A | — | — | **80 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING |
| `L008` | ARANDELA | — | — | M12 ᵉ | N/A | — | — | **80 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING |

## Row 4 — 3 lines · 1 resolved, 2 to review

```
BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L009` | TORNILLO | **AC ᵈ** | 8.8 | M16 | 60 mm | ISO 4017 | CINCADO | 100 | ✅ RESOLVED |
| `L010` | TUERCA | — | — | M16 ᵉ | N/A | ISO 4032 | — | **100 ⁱ** | ⚠️ QUALITY_MISSING, FINISH_SCOPE_UNSTATED |
| `L011` | ARANDELA | — | — | M16 ᵉ | N/A | ISO 7089 | — | **100 ⁱ** | ⚠️ QUALITY_MISSING, FINISH_SCOPE_UNSTATED |

- `L010` — robust to the policy: if the 8.8 were extrapolated to the nut it would be an INCOHERENCE (P-6) and would also go to review

## Row 5 — 3 lines · 2 resolved, 1 to review

```
STUD BOLT 1" X 150 LG, ASTM A193, GR B7, W/ 2 NUT ASTM A194, GR 2H, 1 WASHER ASTM F436
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L012` | ESPARRAGO | **AC ᵈ** | GR B7 ᵘ | 1" | **150 mm ⁱ** | ASTM A193 | — | 24 | ✅ RESOLVED |
| `L013` | TUERCA | **AC ᵈ** | GR 2H ᵘ | 1" ᵉ | N/A | ASTM A194 | — | 48 | ✅ RESOLVED |
| `L014` | ARANDELA | — | — | 1" ᵉ | N/A | ASTM F436 | — | 24 | ⚠️ QUALITY_MISSING |

- `L013` — 'W/ 2 NUT' -> 24x2
- `L014` — '1 WASHER' -> 24x1

## Row 6 — 2 lines · 1 resolved, 1 to review

```
Tornillo DIN 931 M16 x 80 con tuerca DIN 934, 8.8, zincado
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L015` | TORNILLO | **AC ᵈ** | 8.8 | M16 | 80 mm | ISO 4014 | CINCADO | 60 | ✅ RESOLVED |
| `L016` | TUERCA | — | — | M16 ᵉ | N/A | ISO 4032 | — | **60 ⁱ** | ⚠️ QUALITY_MISSING, FINISH_SCOPE_UNSTATED |

## Row 7 — 2 lines · 2 resolved, 0 to review

```
BOLT DIN931 M12x60 A4-70 with NUT DIN934 M12 A4-80
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L017` | TORNILLO | **INOX ᵈ** | A4-70 | M12 | 60 mm | ISO 4014 | — | 50 | ✅ RESOLVED |
| `L018` | TUERCA | **INOX ᵈ** | A4-80 | M12 | N/A | ISO 4032 | — | **50 ⁱ** | ✅ RESOLVED |

- `L018` — A4-80 (G4) on a nut is coherent. This is the row that proves quality is NOT extrapolated

## Row 8 — 3 lines · 0 resolved, 3 to review

```
HEX BOLT M16 x 70 c/w NUT AND WASHER, 8.8, ZN
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L019` | TORNILLO | **AC ᵈ** | 8.8 | M16 | 70 mm | — | CINCADO | 75 | ⚠️ STANDARD_MISSING |
| `L020` | TUERCA | — | — | M16 ᵉ | N/A | — | — | **75 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING, FINISH_SCOPE_UNSTATED |
| `L021` | ARANDELA | — | — | M16 ᵉ | N/A | — | — | **75 ⁱ** | ⚠️ QUALITY_MISSING, STANDARD_MISSING, FINISH_SCOPE_UNSTATED |

- `L019` — the only line that goes to review SOLELY for missing a standard (P-5)

## Row 9 — 3 lines · 1 resolved, 2 to review

```
Conjunto esparrago M20 x 200 DIN 975 con 2 tuercas DIN 934 y 2 arandelas DIN 125, 8.8, zincado
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L022` | ESPARRAGO | **AC ᵈ** | 8.8 | M20 | 200 mm | DIN 975 | CINCADO | 30 | ✅ RESOLVED |
| `L023` | TUERCA | — | — | M20 ᵉ | N/A | ISO 4032 | — | 60 | ⚠️ QUALITY_MISSING, FINISH_SCOPE_UNSTATED |
| `L024` | ARANDELA | — | — | M20 ᵉ | N/A | ISO 7089 | — | 60 | ⚠️ QUALITY_MISSING, FINISH_SCOPE_UNSTATED |

- `L022` — DIN 975 is not in the table of 25: kept as-is (§8)

## Row 10 — 1 line · 1 resolved, 0 to review

```
Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L025` | TORNILLO | **AC ᵈ** | 8.8 | M10 | 40 mm | ISO 4017 | CINCADO | 500 | ✅ RESOLVED |

## Row 11 — 1 line · 1 resolved, 0 to review

```
Tuerca hexagonal DIN 934 M16, A4-80
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L026` | TUERCA | **INOX ᵈ** | A4-80 | M16 | N/A | ISO 4032 | — | 200 | ✅ RESOLVED |

## Row 12 — 1 line · 1 resolved, 0 to review

```
STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L027` | ESPARRAGO | **AC ᵈ** | GR B7 ᵘ | 3/4" | **110 mm ⁱ** | ASTM A193 | — | 40 | ✅ RESOLVED |

- `L027` — no mention of nuts -> a SINGLE line. A set isn't completed by convention

## Row 13 — 1 line · 0 resolved, 1 to review

```
Tuerca autoblocante DIN 985 M12, 8.8, zincada
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L028` | TUERCA | **AC ᵈ** | 8.8 | M12 | N/A | ISO 10511 | CINCADO | 300 | ⚠️ QUALITY_TYPE_INCOHERENCE |

- `L028` — 8.8 (G5) on a nut. NEVER convert it to 8 (G8): different groups

## Row 14 — 1 line · 0 resolved, 1 to review

```
Arandela plana DIN 125 M10, acero, zincada
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L029` | ARANDELA | AC | — | M10 | N/A | ISO 7089 | CINCADO | 250 | ⚠️ QUALITY_MISSING |

- `L029` — the only row in the MTO with an actual material written ('acero'/steel). And it's exactly the one that doesn't give a quality grade

## Row 15 — 1 line · 1 resolved, 0 to review

```
Tornillo Allen cilindrico DIN 912 M10 x 40, 12.9, geomet
```

| | Name | Material | Quality | Measure | Length | Standard | Finish | Qty. | Status |
|---|---|---|---|---|---|---|---|---|---|
| `L030` | TORNILLO | **AC ᵈ** | 12.9 | M10 | 40 mm | ISO 4762 | GEOMET | 120 | ✅ RESOLVED |

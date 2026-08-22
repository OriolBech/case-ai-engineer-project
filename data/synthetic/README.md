# Directed robustness set

**64 rows** built from the gaps in the coverage matrix
(`../../docs/09-coverage-and-blind-set.md`), not at random. One row per gap between what the
client's catalogs contain and what the 15-row MTO exercises.

| File | What |
|---|---|
| `MTO_sintetico.xlsx` | The 64 rows with the same 6-column format as the real MTO, including the `MATERIAL` column trap |
| `expectativas.csv` | Gap covered and expected behavior per row |

## Two rules

1. **Generated from `reglas_tornilleria.md`, not from the given MTO.** It covers what the blind set
   is going to explore, not what is already known to work.
2. **Not run until day 4.** If used to iterate from day 2 onward, it stops measuring
   generalization and becomes a second training set. It is its own blind set.

The expectations were written **before the system existed**. It's the only way to make sure they
are not biased by whatever the system ends up doing.

# Coverage matrix and blind-set preparation

> Status: ✅ closed on day 0. This is the document that drives the robustness set and the
> challenge preparation.

## The thesis

The blind set is 12 rows **they design to test the system**. Nobody designs an exam by repeating
what's already in the study material: it's designed where the material doesn't reach. So the gaps
between what the client's catalogs contain and what the 15-row MTO **exercises** are enumerable,
and they're the most reliable map there is of the blind set.

This is done on day 0 on purpose. Done on day 4, it would be written while looking at what the
system already resolves, and would then measure adherence instead of generalization.

## The matrix

| Catalog | Total | Exercised by the MTO | Coverage | Gaps |
|---|---|---|---|---|
| **Names** | 5 | 4 | 80% | `VARILLA ROSCADA` (and its alias `THREADED ROD`) |
| **Quality · values** | 23 | 5 | **22%** | `10`, `10.9`, `100HV`, `140HV`, `160HV`, `18-8`, `200HV`, `300HV`, `304`, `316`, `8`, `A2-70`, `A2-80`, `A4`, `GRADE 5`, `GRADE 8`, `GRADO 5`, `GRADO 8` |
| **Quality · groups** | 14 | 5 (G1, G3, G4, G5, G7) | **36%** | G2, G6, G8, G9, G10, G11, G12, G13, G14 |
| **Standards · DIN equivalences** | 25 | 6 | **24%** | 19, including the only one that maps to EN (`DIN 6923`) and the two with a `C-H` suffix (`DIN 7981/7982`) |
| **Standards · formats** | 6 | 2 (DIN, ASTM) | 33% | `DIN EN`, direct `ISO`, `ASME`, `MSS SP` |
| **Finish · values** | 7 | 2 | **29%** | DACROMET, HOT-DIP GALVANIZED, PAVONADO, FOSFATADO, BICROMATADO |
| **Finish · aliases** | 19 | 4 | **21%** | `HDG`, `GALVA`, `HOT DIP GALVANIZED`, `BL`, `NEGRO`, `ZP`, `YZP`, `YELLOW ZINC PLATED`, `PHOSPHATED`, and the canonical forms |
| **Units** | — | pure imperial, pure metric | — | mixed within the same row; length with `mm` written out |
| **Languages** | — | ES, EN | — | a third one |

### The finding that matters most

**The quality equivalence table is never exercised.** The five values that appear in the MTO
(`A2`, `A4-70`, `A4-80`, `8.8`, `12.9`) are already the canonical values for their group. The table
exists precisely to recognize that `304` is the same as `A2`, that `316` is the same as `A4-70`,
and that `GRADE 5` is the same as `8.8` — and **no row in the MTO checks it**.

A system that doesn't implement the table and just copies the value passes the 15 given rows with
flying colors. And fails on the blind set. It's the most worthwhile gap to cover and the most
invisible one if you only look at the MTO you're given.

Same with the standards: 6 of 25 DIN→ISO equivalences. A system that only maps `DIN 931`, `933`,
`934`, `125`, `985`, and `912` looks complete against the given data.

### The second finding

`8` and `10` are the only two catalog values the rules explicitly flag with a restriction —
*"only applies to nuts"* — and **neither appears in the MTO**. Row 13 does the reverse test (a nut
with `8.8`, which is inconsistent), but the direct one — a bolt with `8` — is untested. It's the
most obvious consistency check you could set up, and it's waiting.

## The 12 rows I'd bet on

Prediction, not certainty. It's for preparing the challenge, not for optimizing against it.

| # | Bet | What it tests |
|---|---|---|
| 1 | A `VARILLA ROSCADA` / `THREADED ROD` | The only catalog name that's unused |
| 2 | A `304`, `316`, or `18-8` quality | Whether the equivalence table really exists |
| 3 | A `GRADE 5` or `GRADE 8` | Equivalence in American nomenclature |
| 4 | A bolt with quality `8` or `10` | Consistency: only applies to nuts |
| 5 | A washer with `100HV`…`300HV` | The 5 hardness groups, all untouched |
| 6 | An `HDG` / `GALVA` finish | The most common finish on site, and unused |
| 7 | A short, ambiguous alias: `BL`, `ZP`, `YZP` | False negatives from two-letter aliases |
| 8 | A `DIN` outside the 6 used ones, with a `C-H` suffix | Whether the table of 25 is complete and the parser handles the suffix |
| 9 | An `ASME` or `MSS SP` | Formats declared in §8 and never seen |
| 10 | Mixed units (`M20 x 3"`) | That there's no cross-system conversion |
| 11 | A row with a genuinely missing required field | Distinguishing "missing from source" from "not sure" |
| 12 | **A row that isn't fastener hardware** | That the system doesn't invent seven attributes for a flange |

Item 12 is the one that worries me most and the one that prepares itself least: it's the only one
where the failure is completely silent and matches the brief's line about *"buying the wrong
material with a machine's confidence."*

## The targeted synthetic set

`data/synthetic/MTO_sintetico.xlsx` — **64 rows**, with the same 6-column format as the real MTO,
including the `MATERIAL` column trap. One row per gap, not random rows.

| Block | Rows | Covers |
|---|---|---|
| A | 2 | `VARILLA ROSCADA` in ES and EN |
| B | 17 | The 9 quality groups untouched, entered via the non-canonical value |
| C | 3 | `8`/`10` consistency outside of nuts, and HV on a bolt |
| D | 12 | The 5 untouched finishes and their aliases, including the short ones |
| E | 1 | P-1 (finish on a set) with a finish that isn't cincado |
| F | 5 | `ASME`, `MSS SP`, `DIN EN`, direct `ISO`, and `DIN 6923`→`EN 1661` |
| G | 10 | Sample of the 19 untouched DIN equivalences, including `C-H` suffixes |
| H | 5 | Mixed units, explicit `mm`, and missing required fields |
| I | 4 | Out of domain, empty description, missing quantity |
| J | 2 | Third and fourth language (FR, PT) |
| K | 3 | 1:2:4 sets, a set with three different quality groups, a bare secondary item |

`data/synthetic/expectativas.csv` — the expectation for each row, **written before the system
exists**. It's the only way it's not biased by what the system ends up doing.

### Rule of use

**Not run until day 4.** If used to iterate from day 2 onward, it stops measuring generalization
and becomes the second training set. It's the project's own blind set.

## New ambiguities the matrix revealed

Building the matrix surfaced two points **not in section 10 of the rules** that still have to be
decided. Added to `03-policies.md`:

- **P-8 · HV hardnesses outside washers.** The five `HV` qualities are hardness values, typically
  characteristic of washers, but the rules don't restrict them to washers the way they do with
  `8` and `10`. A bolt with `200HV` is, by the letter of the rules, resolvable. A decision of our
  own is needed.
- **P-9 · A row that isn't fastener hardware.** The rules assume everything coming in belongs to
  the family. There's no rule for a flange or a gasket, and the failure mode is the worst of all:
  seven plausible invented attributes on a row that isn't a fastener, coming out as `RESOLVED`.

And two more, which didn't come from the matrix but from **running the synthetic set and looking
at a quantity** (`05-results.md`, row 63):

- **P-10 · A bare number in a set's measure field.** The extractor puts the nut's quality (`10`)
  or the washer's standard number (the `125` in `DIN 125`) into the measure field. It passes span
  verification, comes out with 0.95 confidence, and blocks extrapolation of the actual measure.
- **P-11 · What to do with that value once discarded.** When the catalog recognizes it as a quality
  and it's consistent with the type, it's the quality. If not, it's dropped.

Both are closed by the client's rules without a model (§6 and §2), and both are a bet for the
blind set: it's the sibling of the `MATERIAL` column trap, but inside the description.

P-9 is, of everything detected in the case, the one with the most silent failure. And it's a good
candidate for the reserve-question slot if, while building it, some nuance shows up that I can't
close on my own.

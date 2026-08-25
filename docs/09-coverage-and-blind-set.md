# Coverage matrix and blind-set preparation

> Status: ✅ closed on day 0. This is the document that drives the robustness set and the
> challenge preparation.

## The thesis

The blind set is 12 rows that **they design to test the system**. Nobody designs an exam by
repeating what's already in the study material: it's designed where the material doesn't reach.
So the gaps between what the client's catalogs contain and what the 15-row MTO **exercises**
are enumerable, and they are the most reliable map of the blind set that exists.

This is done deliberately on day 0. Done on day 4, it would be written looking at what the
system already solves, and then it would measure adherence instead of generalization.

## The matrix

| Catalog | Total | Exercised by the MTO | Coverage | Gaps |
|---|---|---|---|---|
| **Names** | 5 | 4 | 80% | `VARILLA ROSCADA` (threaded rod) (and its alias `THREADED ROD`) |
| **Quality · values** | 23 | 5 | **22%** | `10`, `10.9`, `100HV`, `140HV`, `160HV`, `18-8`, `200HV`, `300HV`, `304`, `316`, `8`, `A2-70`, `A2-80`, `A4`, `GRADE 5`, `GRADE 8`, `GRADO 5`, `GRADO 8` |
| **Quality · groups** | 14 | 5 (G1, G3, G4, G5, G7) | **36%** | G2, G6, G8, G9, G10, G11, G12, G13, G14 |
| **Standards · DIN equivalences** | 25 | 6 | **24%** | 19, including the only one that maps to EN (`DIN 6923`) and the two with a `C-H` suffix (`DIN 7981/7982 C-H`) |
| **Standards · formats** | 6 | 2 (DIN, ASTM) | 33% | `DIN EN`, direct `ISO`, `ASME`, `MSS SP` |
| **Finish · values** | 7 | 2 | **29%** | DACROMET, GALVANIZADO EN CALIENTE, PAVONADO, FOSFATADO, BICROMATADO |
| **Finish · aliases** | 19 | 4 | **21%** | `HDG`, `GALVA`, `HOT DIP GALVANIZED`, `BL`, `NEGRO`, `ZP`, `YZP`, `YELLOW ZINC PLATED`, `PHOSPHATED`, and the canonical forms |
| **Units** | — | pure imperial, pure metric | — | mixed within the same row; length with `mm` spelled out |
| **Languages** | — | ES, EN | — | a third one |

### The finding that matters most

**The quality-equivalence table is never exercised.** The five values that appear in the MTO
(`A2`, `A4-70`, `A4-80`, `8.8`, `12.9`) are already the canonical ones for their group. The table
exists precisely to recognize that `304` is the same as `A2`, that `316` is the same as `A4-70`,
and that `GRADE 5` is the same as `8.8` — and **no row in the MTO checks this**.

A system that doesn't implement the table and simply copies the value through passes the 15
given rows with flying colors. And fails the blind set. It's the most profitable gap to cover
and the most invisible one if you only look at the MTO you're given.

Same with the standards: 6 of 25 DIN→ISO equivalences. A system that only maps `DIN 931`,
`933`, `934`, `125`, `985`, and `912` looks complete against the given data.

### The second finding

`8` and `10` are the only two values in the catalog that the rules explicitly flag with a
restriction — *"only applies to nuts"* — and **neither one appears in the MTO**. Row 13 runs the
inverse test (a nut with `8.8`, which is incoherent), but the direct one — a bolt with `8` — is
untested. It's the most obvious coherence test you could pose, and it's just sitting there.

## The 12 rows I would bet on

Prediction, not certainty. It's here to prepare the challenge, not to optimize against it.

| # | Bet | What it tests |
|---|---|---|
| 1 | A `VARILLA ROSCADA` / `THREADED ROD` (threaded rod) | The one catalog name never used |
| 2 | A `304`, `316`, or `18-8` quality | Whether the equivalence table really exists |
| 3 | A `GRADE 5` or `GRADE 8` | Equivalence in American nomenclature |
| 4 | A bolt with quality `8` or `10` | Coherence: they only apply to nuts |
| 5 | A washer with `100HV`…`300HV` | The 5 hardness groups, all untouched |
| 6 | An `HDG` / `GALVA` finish | The most common finish on site, and unused |
| 7 | A short, ambiguous alias: `BL`, `ZP`, `YZP` | False negatives from two-letter aliases |
| 8 | A `DIN` outside the 6 used, with a `C-H` suffix | Whether the table of 25 is complete and the parser can handle the suffix |
| 9 | An `ASME` or `MSS SP` | Formats declared in §8 and never seen |
| 10 | Mixed units (`M20 x 3"`) | That there's no conversion between systems |
| 11 | A row with a truly missing required field | Distinguishing "missing at source" from "not sure" |
| 12 | **A row that isn't fasteners at all** | That the system doesn't invent seven attributes for a flange |

Bet 12 is the one that worries me most and the one that's least likely to fix itself: it's the
only one where the failure is completely silent, and it matches the brief's own phrase about
*"buying the wrong material with a machine's confidence."*

## The directed synthetic set

`data/synthetic/MTO_sintetico.xlsx` — **64 rows**, in the same 6-column format as the real MTO,
including the `MATERIAL` column trap. One row per gap, not random rows.

| Block | Rows | Covers |
|---|---|---|
| A | 2 | `VARILLA ROSCADA` (threaded rod) in ES and EN |
| B | 17 | The 9 untouched quality groups, entering via the non-canonical value |
| C | 3 | `8`/`10` coherence outside a nut, and HV on a bolt |
| D | 12 | The 5 untouched finishes and their aliases, including the short ones |
| E | 1 | P-1 (finish on a set) with a finish that isn't zinc-plated |
| F | 5 | `ASME`, `MSS SP`, `DIN EN`, direct `ISO`, and `DIN 6923`→`EN 1661` |
| G | 10 | Sample of the 19 untouched DIN equivalences, including `C-H` suffixes |
| H | 5 | Mixed units, explicit `mm`, and missing required fields |
| I | 4 | Out of domain, empty description, missing quantity |
| J | 2 | Third and fourth languages (FR, PT) |
| K | 3 | 1:2:4 sets, a set with three distinct quality groups, a bare secondary element |

`data/synthetic/expectativas.csv` — the expectation for each row, **written before the
system exists**. It's the only way to ensure it isn't biased by whatever the system ends up
doing.

The **executable** subset of these bets (rule invariants, not 7 hand-labeled cells) lives in
`src/eval/trap-cases.ts` and is measured with `pnpm run traps` / `pnpm test`. The CSV isn't turned
into a second gold set: that would be the training set this usage rule forbids.

### Usage rule

**It does not run until day 4.** If used to iterate from day 2 onward, it stops measuring
generalization and becomes the second training set. It is its own blind set.

## New ambiguities the matrix revealed

Building the matrix surfaced two points that **are not in section 10 of the rules** and still
need to be decided. Added to `03-policies.md`:

- **P-8 · HV hardness values outside a washer.** The five `HV` qualities are hardness values,
  characteristically found on washers, but the rules don't restrict them to washers the way they
  do with `8` and `10`. A bolt with `200HV` is, by the letter of the rules, resolvable. A
  standalone decision is needed.
- **P-9 · A row that isn't fasteners.** The rules assume everything coming in belongs to the
  family. There's no rule for a flange or a gasket, and the failure mode is the worst of all:
  seven plausible invented attributes on a row that isn't a bolt, coming out as `RESUELTA`
  (resolved).

And two more, which didn't come from the matrix but from **running the synthetic set and looking
at a quantity** (`05-results.md`, row 63):

- **P-10 · A bare number in the size field of a set.** The extractor puts the nut's quality
  (`10`) or the washer's standard number (the `125` from `DIN 125`) into the size field. It
  passes the span check, comes out with 0.95 confidence, and blocks extrapolation of the correct
  size.
- **P-11 · What to do with that value once discarded.** When the catalog recognizes it as
  quality and it's coherent with the type, it becomes the quality. If not, it's dropped.

Both are closed by the client's own rules, no model needed (§6 and §2), and both are bets for the
blind set: it's the sibling of the `MATERIAL` column trap, but inside the description.

Of everything detected in this case, P-9 is the one with the most silent failure. And it's a good
candidate for the held-in-reserve question slot if some nuance shows up while building it that I
can't close on my own.

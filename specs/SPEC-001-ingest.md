# SPEC-001 · Ingestion

| | |
|---|---|
| **File** | `src/pipeline/ingest.ts` |
| **Stage** | 1 |
| **LLM** | No |
| **Status** | 🚧 |

## Purpose

Convert an MTO Excel file into normalized text rows, without interpreting anything.

## Why not an LLM

It's I/O and header detection. The only subtlety is a business one, not a linguistic one.

## Contract

**Input**: `Buffer` from `.xlsx` (or `.csv`).
**Output**: `MtoRow[]` — see `src/pipeline/types.ts`.

**Invariants**
- The original text of each row is preserved **literally**, with stable offsets. All of the
  downstream pipeline references spans over it, and the challenge requires being able to display them.
- No semantic transformation at this stage. No trimming of values, no upper-casing the blob.

## Behavior

1. Locate the header row: it's the first row with ≥3 non-empty cells. Preceding rows
   (title, blanks) are discarded.
2. **Don't trust the column names.** The given MTO has a column named `MATERIAL`
   that actually contains quality or standard. Headers are stored as metadata, not as semantics.
3. Build a `sourceText` per row by concatenating **all** the text cells in order, with a
   known separator, and record the starting offset of each cell. Quality and standard can
   appear only in the `MATERIAL` column, so dropping columns loses information.
4. Quantity and unit are read from numeric columns when they exist, and are also kept in
   the `sourceText` so the segmenter can see the context.

## Edge cases

| Case | Behavior |
|---|---|
| Fully empty row | Discarded, counted in the report |
| No quantity column | `quantity: null`; the validator decides |
| Merged cells | The anchor cell's value is read |
| Headers in English / in a different order | Irrelevant: not used as semantics |
| Multiple sheets | The first one with recognizable headers is processed; the rest are flagged |

## Acceptance criteria

- [ ] The 15 rows of the given MTO are read as 15 `MtoRow`, ignoring the title and blanks.
- [ ] Row 1's `sourceText` contains both the description **and** `ASTM A193 GR B7/A194 GR 2H`.
- [ ] The offsets allow recovering any exact substring from the original Excel file.
- [ ] A CSV with the same rows produces the same result.

## What happens to the KPI if this is removed

N/A: without ingestion there's no pipeline. But **if it drops columns**, row 1 loses the standard
for the nut and washer and those two lines fall into review. Measured cost: _pending_.

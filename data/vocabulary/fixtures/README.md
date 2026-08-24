# Finish vocabulary fixtures

**Realistic** MTO rows for testing the *gap → decision → entry in
`finish-alias.log.jsonl`* loop without depending on the 15-row reference MTO, which doesn't carry
unknown finishes. **21 rows** in `acabados-mto.csv`.

## How finishes usually show up in a real MTO

Patterns pulled from `docs/domain/07-finishes.md`, from the reference MTO, and from typical spec
sheets (EPC, structural, machinery):

| Pattern in the description | What it usually means | Typical vocabulary action |
|---|---|---|
| `zincado`, `zinc plated`, `ZN`, `ZP` | Electrolytic zinc plating | Already in the seed → `CINCADO` |
| `HDG`, `HOT DIP`, `galvanizado en caliente`, `GALVA` | Hot-dip galvanizing | Already in the seed (or a new short alias) |
| `GEOMET`, `GEOMET-500B`, `dacromet` | Brands / catalog variants | Variant → base finish; not a gap |
| `Delta-Protekt`, `Magni 565`, `tropicalizado` | Name of the **design office** or commercial brand | **Alias addition** with evidence from the spec sheet |
| `PLAIN`, `SELF-COLOUR`, `según pliego` | No finish or administrative text | **`not_a_finish`** — don't invent a §9 entry |
| `zinc flake` (no brand) | Geomet/Dacromet family | **Escalate** or review — don't guess |
| `niquelado`, `PTFE`, `pintado RAL…` | Outside the 7 in §9 | **Escalate** — an eighth finish, not self-service |
| Compound finish (`zincado amarelo`) | The short alias `zincado` wins if the long one doesn't exist | Add **the whole compound** before the short one (V21) |

Typical Excel format (same as the case's MTO):

```
ITEM | DESCRIPCION | MATERIAL | MEDIDA | CANT. | UD
```

To feed **several** vocabularies at once (finish, material, and see name/standard in its own
cell), use `data/synthetic/MTO_sugerencias.xlsx` (`pnpm run mto:synthetic`), which adds `NOMBRE |
NORMA | ACABADO` and a `guia` sheet.

- **DESCRIPCION** mixes the finish in with standard, measure, quality, and language (ES/EN/PT/FR).
- **MATERIAL** is almost never material: it's usually `8.8`, `A4-70`, `ASTM A193 GR B7`…
- The finish goes **at the end** of the sentence or the set, comma-separated.

## Convention for maintaining the vocabulary

### 1. Entry id (traceability)

```
finish-{alias-slug}
```

Examples: `finish-tropicalizado`, `finish-delta-protekt-kl100`, `finish-plain`.

The slug is lowercase, no accents, hyphens instead of spaces. **Never reuse ids**: it's the audit
trail of what was purchased.

### 2. The three possible decisions (SPEC-011)

| Decision | `kind` | `finish` | When |
|---|---|---|---|
| It's an alias for one of the 7 | `alias` | `CINCADO` … | There's a source (spec sheet, standard, supplier) |
| It's not a finish | `not_a_finish` | `null` | PLAIN, according to spec sheet, painted… |
| Eighth finish / ambiguous | — | — | **No addition**: escalate to the client |

### 3. Required fields on every entry

- **`evidence`**: where it's written down (spec sheet §, standard, supplier email). Never "just
  because".
- **`rationale`**: why that alias equals that catalog finish.
- **`decidedBy`**: person signing off on the decision.

### 4. Maintenance loop (buyers — front end)

1. Upload the MTO (or the playground Excel) in **Home**.
2. Open **How it went** → *Decisions no one has made yet*.
3. On an unknown finish: **Add to vocabulary** → choose a §9 catalog entry or *Not a finish*,
   reason, evidence, your name → **Confirm**.
4. Alternative: **Vocabulary** tab (`/vocabulario`) — single view of all attributes; the id
   generates itself and supports `?attr=finish&alias=tropicalizado` to open it prefiltered and
   preloaded.

### 5. Maintenance loop (CLI / development)

```bash
# See what the vocabulary would do today (no LLM, over the extracted text)
pnpm run vocab:fixtures

# Generate a test Excel (optional, for gaps/pipeline)
pnpm run vocab:fixtures -- --write-xlsx

# Test a specific alias
pnpm run finish:vocab -- test --alias='tropicalizado'

# Add an entry (writes to finish-alias.log.jsonl)
pnpm run finish:vocab -- add \
  --id=finish-tropicalizado --alias=tropicalizado --finish=CINCADO \
  --why='Equivalence per spec sheet §4.2' \
  --by='First Last' --evidence='MTO spec sheet rev.3 §4.2'

# Gaps from a processed MTO (with LLM + cache)
pnpm run gaps -- data/vocabulary/fixtures/MTO_acabados_playground.xlsx
```

The source of truth is **`data/vocabulary/finish-alias.log.jsonl`** (git). The SQLite database
rebuilds itself.

## Files

| File | Content |
|---|---|
| `acabados-mto.csv` | 21 rows with MTO description, finish to test, and expected action |
| `MTO_acabados_playground.xlsx` | Generated with `--write-xlsx`; same content in Excel format |

## CSV columns

| Column | Use |
|---|---|
| `acabado_extraido` | Text the extractor **would already isolate** as the finish (not free scanning) |
| `accion_esperada` | `ya_cubierto` · `alta_alias` · `not_a_finish` · `escalar` |
| `finish_destino` | One of the 7 from §9 when `accion_esperada=alta_alias` or `ya_cubierto` |
| `id_sugerido` | Proposed id for the log |
| `evidencia` / `rationale` | Template for the real entry |

The automated tests (`src/rules/__tests__/vocab-fixtures.test.ts`) check that `resolveFinish`
behaves as the CSV indicates **before** promoting entries to the log.

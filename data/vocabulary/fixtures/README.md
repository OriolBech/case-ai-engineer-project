# Finish vocabulary fixtures

**Realistic** MTO rows for testing the *gap → decision → entry in
`finish-alias.log.jsonl`* loop without depending on the 15-row reference MTO, which doesn't carry
any unknown finishes. **21 rows** in `acabados-mto.csv`.

## How finishes usually show up in a real MTO

Patterns extracted from `docs/domain/07-finishes.md`, from the reference MTO, and from common
specs (EPC, structural, machinery):

| Pattern in the description | What it usually means | Typical vocabulary action |
|---|---|---|
| `zincado`, `zinc plated`, `ZN`, `ZP` | Electrolytic zinc plating | Already in seed → `CINCADO` |
| `HDG`, `HOT DIP`, `galvanizado en caliente`, `GALVA` | Hot-dip galvanizing | Already in seed (or new short alias) |
| `GEOMET`, `GEOMET-500B`, `dacromet` | Brands / variants of the catalog | Variant → base finish; not a gap |
| `Delta-Protekt`, `Magni 565`, `tropicalizado` | Name of the **design office**'s or a commercial brand | **Alias entry** with spec evidence |
| `PLAIN`, `SELF-COLOUR`, `según pliego` | No finish or administrative text | **`not_a_finish`** — don't invent a §9 |
| `zinc flake` (no brand) | Geomet/Dacromet family | **Escalate** or review — don't guess |
| `niquelado`, `PTFE`, `pintado RAL…` | Outside the 7 of §9 | **Escalate** — an eighth finish, not self-service |
| Compound finish (`zincado amarelo`) | The short alias `zincado` wins if the long one doesn't exist | Add **the whole compound** before the short one (V21) |

Typical Excel format (same as the case's MTO):

```
ITEM | DESCRIPCION | MATERIAL | MEDIDA | CANT. | UD
```

- **DESCRIPCION** mixes the finish with standard, size, quality, and language (ES/EN/PT/FR).
- **MATERIAL** is almost never material: it's usually `8.8`, `A4-70`, `ASTM A193 GR B7`…
- The finish goes **at the end** of the sentence or the set, separated by commas.

## Convention for maintaining the vocabulary

### 1. Entry id (traceability)

```
finish-{alias-slug}
```

Examples: `finish-tropicalizado`, `finish-delta-protekt-kl100`, `finish-plain`.

The slug is lowercase, no accents, hyphens instead of spaces. **Don't reuse ids**: it's the trace
of what was bought.

### 2. The three possible decisions (SPEC-011)

| Decision | `kind` | `finish` | When |
|---|---|---|---|
| It's an alias for one of the 7 | `alias` | `CINCADO` … | There's a source (spec, standard, vendor) |
| It's not a finish | `not_a_finish` | `null` | PLAIN, según pliego, pintado… |
| Eighth finish / ambiguous | — | — | **No entry**: escalate to the client |

### 3. Required fields in every entry

- **`evidence`**: where it's written (spec §, standard, vendor email). Never "just because."
- **`rationale`**: why that alias is equivalent to that catalog finish.
- **`decidedBy`**: the person signing off the decision.

### 4. Maintenance loop (procurement — front end)

1. Upload the MTO (or the playground Excel) on **Inicio** ("Home").
2. Open **Cómo ha ido** ("How it went") → *Decisiones que nadie ha tomado todavía* ("Decisions
   nobody has made yet").
3. On an unknown finish: **Añadir al vocabulario** ("Add to vocabulary") → choose §9 catalog or
   *No es acabado* ("Not a finish"), reason, evidence, your name → **Confirmar** ("Confirm").
4. Alternative: **Acabado** ("Finish") tab (`/vocabulario/acabado`) — the id is generated
   automatically; it accepts `?alias=tropicalizado` to preload the text.

### 5. Maintenance loop (CLI / development)

```bash
# See what the vocabulary would do today (no LLM, over the extracted text)
pnpm run vocab:fixtures

# Generate a test Excel file (optional, for gaps/pipeline)
pnpm run vocab:fixtures -- --write-xlsx

# Test a specific alias
pnpm run finish:vocab -- test --alias='tropicalizado'

# Add an entry (writes to finish-alias.log.jsonl)
pnpm run finish:vocab -- add \
  --id=finish-tropicalizado --alias=tropicalizado --finish=CINCADO \
  --why='Equivalencia según pliego §4.2' \
  --by='Nombre Apellido' --evidence='Pliego MTO rev.3 §4.2'

# Gaps of a processed MTO (with LLM + cache)
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
| `acabado_extraido` | Text that the extractor **would already isolate** as the finish (no free scanning) |
| `accion_esperada` | `ya_cubierto` · `alta_alias` · `not_a_finish` · `escalar` |
| `finish_destino` | One of the 7 from §9 when `accion_esperada=alta_alias` or `ya_cubierto` |
| `id_sugerido` | Proposed id for the log |
| `evidencia` / `rationale` | Template for the real entry |

The automated tests (`src/rules/__tests__/vocab-fixtures.test.ts`) check that `resolveFinish`
behaves as the CSV indicates **before** promoting entries to the log.

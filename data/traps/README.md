# Trap bank

This is not a second gold set. The gold set (`../gold/gold.jsonl`) labels seven attributes plus
quantity over the 15 rows of the given MTO. This bank asserts **invariants that a client rule (or
a declared policy) already decides**: "an 8 on a bolt is inconsistent," "HDG is hot-dip
galvanized," "a flange isn't resolved."

Why it exists separately from the gold set:

- I wrote both the gold set and the prompt. A shared blind spot isn't caught by that measurement.
- The given MTO doesn't exercise the equivalence table, nor `8`/`10` on a nut, nor HDG, nor a
  third language, nor P-9.
- `pnpm test` has to be able to fail **without** calling the model.

The `must` traps break CI. The `hole` traps are printed by `pnpm run traps` and document what the
tables alone still don't close (the delta the LLM has to earn its keep on). If a hole gets closed,
the scorecard says so; the test doesn't turn red.

Current baseline holes (not CI):

- `H-attr` — `MATERIAL` concatenated at the end of the row attaches to the last name mentioned
  (the washer inherits `GR B7`).
- `H-de-finish` — an uncataloged German finish term (`feuerverzinkt`) doesn't trigger P-12; the
  bolt gets resolved.
- `H1` — `M20 x 3"` is read as 3 mm and gets resolved. `UNIT_MISMATCH` only triggers if the length
  arrives with an explicit unit and `basis === 'stated'`.

The 64-row synthetic set (`../synthetic/`) is still the coverage map. This bank is the
**executable, 7-cell-gold-free** subset. Don't label those 64 rows as gold after seeing the
system: that would turn them into the second training set that `docs/09` prohibits.

```bash
pnpm test                        # includes the musts
pnpm run traps                   # scorecard (musts + holes)
```

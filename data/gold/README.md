# Gold set

The reference measured against. **The case doesn't provide it**: building it was the first
decision and half of the session's conversation. Method in `../../docs/02-kpi.md` §1.

| File | What |
|---|---|
| `gold.jsonl` | ⬜ One expected output line per record |
| `pass-1.jsonl` | ⬜ First labeling pass |
| `pass-2.jsonl` | ⬜ Second pass, blind relative to the first |
| `self-consistency.md` | ⬜ Discrepancies between passes = lower bound on the human error rate |

**Rule**: labeling happens **before** the system is built. If it's labeled afterward, what gets
labeled is what the system already does.

**Rule 2**: every cell carries `certainty: "certain" | "policy_dependent"`. Policy-dependent ones
are excluded from the primary metrics and reported as sensitivity.

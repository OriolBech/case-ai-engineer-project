# ADR-004 · Local cache of model responses

- **Date**: 2026-08-21
- **Status**: accepted

## Context

The evaluation harness will run dozens of times over 5 days. And the system has to work in a
60-minute live demo, in a room whose network I don't control, with the explicit requirement of
*"checking a cold start beforehand"*.

## Decision

On-disk cache of model responses, keyed by `hash(provider + model + prompt)`, in
`data/output/.llm-cache/` (git-ignored). Enabled with `LLM_CACHE=on`.

## Consequences

Three things, and the third is what justifies the component:

1. **Near-zero development cost**: you only pay the first time a prompt changes.
2. **Deterministic harness**: without this you can't tell a real improvement apart from the
   model's variance between runs, and the entire KPI relies on being able to tell them apart.
3. **De-risks the demo**: if the network fails in the room, the known part of the MTO keeps
   running from cache. Only the blind set needs real network access, and that's 12 rows.

**Against it**: it has to be invalidatable deliberately. A policy change (`POLICY_*`) doesn't
change the prompt but does change the pipeline's expected output, so the cache **only covers the
call to the model**, never the result of the normalizer or the validator, which are deterministic
and cheap. If the cache covered the entire pipeline, toggling a policy during the challenge would
have no visible effect — which is exactly the demonstration I want to be able to give.

**Note for the session**: it has to be disclosed that it exists. An evaluator who discovers an
undeclared cache while running the blind set will think the worst. Disclosing it and explaining
why is defensible; hiding it is not.

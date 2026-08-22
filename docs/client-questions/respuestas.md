# Client responses

Received on 2026-08-22 from Jeremie, with Adolfo (partner and COO) cc'd.

---

## Q2 · Scope of finish across a set → **CLOSED ANSWER**

> "Only the measurement extrapolates."

No ambiguity. **P-1 changes**: a finish written once at the row level does **not**
reach the rest of the elements in the set.

### What that does NOT mean

It doesn't mean secondary elements should be resolved with a blank finish. There are two readings and only one
holds up:

- *"The finish doesn't reach, so the secondary element has no finish."* That's asserting absence, and
  is just as much an inference as extrapolating — with the difference that, under the no-mixing
  rule (§9), **it changes the reference being purchased**: a zinc-plated screw with a bare nut are two
  different materials.
- *"The finish is on the row but unattributed."* Present and unattributed is not the same as
  absent. The system cannot decide who it reaches, so it **goes to review** with a reason that
  says exactly that.

The "blank is valid" from §9 is written for rows where **no** finish appears at all, not for
a row where one appears whose scope isn't stated. It's implemented as its own reason,
`FINISH_SCOPE_UNSTATED`, and matches the default we announced in the email: *"if the scope is
in doubt, review."*

---

## Q1 · Derived material → **NOT ANSWERED DIRECTLY, and the redirect is worth more**

> "Indeed, we need to try to be 100% sure of the result. I imagine the key is
> figuring out how to get the missing rules right in order to guarantee that certainty at
> scale. At the same time, no two MTOs are alike, they always differ, so it helps to think about the
> **system behind the rules, not just the rules**."

It's neither a yes nor a no to the derivation. It's a shift in the level of the question, and it has to be read as
such because it reorients the deliverable:

1. **The goal is certainty, not coverage.** Derive only what is deterministic and unambiguous; the rest
   goes to review. This is exactly the default we proposed, so P-3 stands — but the acceptance
   criterion is no longer "how much do I resolve" but rather "of what I resolve, how much is certain."
2. **The problem is getting the MISSING rules right, at scale.** Not the ones that already exist.
3. **No two MTOs are alike.** A set of rules tuned to one file doesn't survive the
   next one.

### The architectural consequence, which is uncomfortable

Our policies P-1…P-9 are **rules**, not a system behind the rules. And they have a failure
mode that this email puts at the center: faced with a case no policy covers, the system applies
a default **and resolves it**. Silently. With a new MTO, that's not robustness: it's an
expensive error delivered with a machine's confidence.

What's missing isn't more rules. It's the system's ability to say **"I've never seen this before"**
instead of resolving it by default, and turning that gap into a traceable decision instead of
a purchased line. See `docs/12-system-behind-the-rules.md`.

---

## Remaining slot

**One** of the three questions is still open. The candidate declared in the email: the unit for
imperial lengths when it isn't written explicitly (P-4). Not spent yet.

# Client answers

Received on 2026-08-22 from Jeremie, with Adolfo (partner and COO) cc'd.

---

## Q2 · Scope of the finish within a set → **CLOSED ANSWER**

> "Only the measure gets extrapolated."

No ambiguity. **P-1 changes**: a finish written once at the row level does **not** extend to the
rest of the elements in the set.

### What that does NOT mean

It doesn't mean the secondary elements get resolved with a blank finish. There are two readings and
only one holds up:

- *"The finish doesn't extend, so the secondary element has no finish."* That's asserting absence,
  and it's an inference just like extrapolating — with the difference that, per the no-mixing rule
  (§9), it **changes the reference being purchased**: a zinc-plated bolt with a bare nut are two
  different materials.
- *"The finish is in the row but not attributed."* Present and unattributed is not the same as
  absent. The system can't decide who it applies to, so it **goes to review** with a reason that
  says exactly that.

The "blank is valid" from §9 is written for rows where **no** finish appears at all, not for a row
where one appears but its scope isn't stated. It's implemented as its own reason,
`FINISH_SCOPE_UNSTATED`, and it matches the default we announced in the email: *"if scope is in
doubt, review."*

---

## Q1 · Derived material → **NOT ANSWERED DIRECTLY, and the redirect is worth more**

> "You do indeed need to try to be 100% certain of the outcome. The key, I imagine, is thinking
> about how to nail down the correct missing rules to secure that certainty at scale. At the same
> time, no two MTOs are alike, they always differ, so it helps to think about the **system behind
> the rules, not just the rules**."

It's neither a yes nor a no to the derivation. It's a change in the level of the question, and it
has to be read as such because it reorients the deliverable:

1. **The goal is certainty, not coverage.** Derive only what's deterministic and unambiguous; the
   rest goes to review. That's exactly the default we proposed, so P-3 stands — but the acceptance
   criterion stops being "how much do I resolve" and becomes "of what I resolve, how much is
   certain."
2. **The problem is getting the MISSING rules right, at scale.** Not the ones that exist.
3. **No two MTOs are alike.** A rule set tuned to one file doesn't survive the next one.

### The architectural consequence, and it's an uncomfortable one

Our policies P-1…P-11 are **rules**, not a system behind the rules. And they have a failure mode
that this email puts front and center: faced with a case no policy covers, the system applies a
default **and resolves it**. Silently. With a new MTO, that isn't robustness: it's a costly error
wearing the confidence of a machine.

What's missing isn't more rules. It's for the system to know how to say **"I've never seen this
before"** instead of resolving it by default, and for that gap to become a traceable decision
instead of a purchased line. See `docs/11-system-behind-the-rules.md`.

---

## Remaining slot — still unspent · 2026-08-23

One of the three questions is still unspent, and a day away from delivery the decision is **not to
spend it**. It isn't an oversight: the email already said why it was being held back — *"I'm saving
one for when I'm implementing, because that's when the things I don't see today usually turn
up"* — so the bar for spending it is *"implementing uncovered something day 0 didn't show, and I
can't close it alone."*

**Implementing uncovered three things, and each is closed by its own rules:**

| What came up | Why it doesn't spend a slot |
|---|---|
| **P-10** · a bare number in the size field of a set (row 63: the nut's quality and the washer's standard number ended up there) | Closed by §6 (a size is inches or metric) and §2 (size is the only thing extrapolated). Unilateral, deterministic criterion |
| **P-11** · what to do with that value once discarded | Closed by the quality table in §5, with the type-coherence guard. Nothing to ask |
| The critic truncating on `max_tokens` | My bug, not their ambiguity |

**Candidates evaluated and discarded**, using the `ADR-002` filter (all three conditions must hold):

| Candidate | What it fails |
|---|---|
| **P-4** · unit of imperial lengths | The candidate declared in the email. Still fails condition 1: there's a defensible physical criterion, and what the range can't separate falls to review instead of being resolved incorrectly. Impact: 3 cells out of 240 |
| **P-9** · whether out-of-family rows should be silently ignored | Held as a candidate while implementing it. No nuance emerged: the conservative criterion holds up and the flag demonstrates the alternative |
| Convention *"VARILLA ROSCADA (threaded rod) with no standard → DIN 975/976"* | Measured cost of not having it: 2 lines out of 101. Defensible conservative criterion. Goes to the session, not the email |
| **Does a vocabulary and policy standard fall within scope?** | Fails condition 1 (the brief closes it: *"a single family… depth, not breadth"*) and condition 3 (it doesn't change a single line of the blind set). And Jeremie already answered it without being asked: *"it helps to think about the system behind the rules"*. It goes to the session as a statement, not a question: *"I built the vocabulary in two layers assuming fasteners is the first family and not the only one; if it's the only one, layer 2 is unnecessary and I'll say so myself"* |

**The line for the session**, worth more than the question itself: *"I saved one for whatever day 0
didn't show me. I implemented, three things came up, and their own rules closed all three. So I'm
not spending it."*

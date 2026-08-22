# Project timeline

> Reconstructed from the **4 work sessions** on record (Aug 20–21, 2026).
> Times in UTC. Documents *how* each decision was reached, not just what it was: the
> changes of mind and self-corrections are the useful part.

## Session map

| # | Session | Window | What was done |
|---|---|---|---|
| 1 | `4071fafa` | Aug 20 11:08 → Aug 21 16:55 | **Trunk**: requirements, plan, structure, policies, coverage, deterministic tables, gold set |
| 2 | `da5f56e0` | Aug 21 16:32 → 16:39 | Sapira design system extracted from the live site |
| 3 | `903bfc3e` | Aug 21 16:38 → 16:43 | Private GitHub repo + initial commit (with Sonnet 5) |
| 4 | `a481c4eb` | Aug 21 16:46 → 16:54 | Critical review of the questions: 3 → 2, and rewrite of the email (with Opus 5) |

Sessions 2–4 are **branches off the trunk**, opened in parallel for bounded tasks (browser,
git, judgment call on the email) without polluting the main context.

---

## Phase 0 · Understanding the brief (Aug 20, 11:08–11:12)

**Kickoff prompt:** *"analiza el pdf para averiguar todos los requisitos que piden"*.

There was no repo yet: just the case PDF, `MTO_tornilleria.xlsx`, and `reglas_tornilleria.md`
loose in the folder. First task: extract the PDF (6 pages) and the 15 Excel rows, and structure
the requirements.

**The finding that ordered everything else was the asymmetry of error cost**, which was in the
brief but not as a headline:

| Error | Cost |
|---|---|
| **False resolved** — accepting a badly extracted row as good | 3–8 weeks of site delay + milestone penalty |
| **False to review** — sending a human something that was actually fine | ~90 s of a procurement person's time |

A three-order-of-magnitude ratio. That decides the KPI, the confidence threshold, and the
critic's design. From here on, "accuracy" stopped being the metric and *"autonomy at a fixed
accuracy"* became it instead.

## Phase 1 · The plan and its three principles (Aug 20, 11:12–11:30)

**Prompt:** *"haz un plan de accion […] y analiza que 3 preguntas serian interesantes"*.

The plan (`docs/00-action-plan.md`) rested on three decisions that come **before** writing any
code:

1. **The gold set is labeled by hand before the system is built.** If it's labeled afterward,
   you're labeling what the system already does. And since the final judgment runs against a
   blind set, the only transferable asset is the judgment, not the tuning.
2. **The LLM only where there's language.** The case explicitly evaluates *"si sabes cuándo no
   hace falta un agente"* [whether you know when an agent isn't needed] → you have to **measure**
   what the model contributes over a deterministic baseline and bring that number.
3. **The ambiguities in section 10 become explicit, toggleable policy**, not implicit behavior.
   One flag per decision, so the live challenge doesn't break anything: when they ask *"¿y si el
   acabado sólo alcanza al tornillo?"*, you just flip the flag.

## Phase 2 · Repo structure (Aug 20, 11:30–11:42)

**Prompt:** *"crea la estructura del proyecto, entre ellas donde vamos a poner las specs […] y
documentacion"*.

Before creating the tree there was a pause to fix the stack (**ADR-001**: Next.js monolith in TS,
docs in Spanish and code in English), because that choice changes the whole structure.

The separation that emerged, with one rule keeping each layer clean:

| Level | Content | Rule |
|---|---|---|
| `specs/` | The **what**: contract, I/O, edge cases, acceptance | If spec and code disagree, one of them is a bug and gets fixed in the same commit |
| `docs/` | The **why**: plan, requirements, KPI, policies, results | Each doc feeds a specific section of the 2-pager |
| `docs/decisions/` | ADRs | Append-only: a decision isn't rewritten, it's superseded |

Also created were `src/pipeline/types.ts` as an **executable spec** (the domain contract in code)
and `src/rules/policies.ts` as the single home for decisions the client didn't make.

## Phase 3 · Self-correcting the questions (Aug 20, 12:06 → Aug 21, 16:54)

This is the thread with the most iteration in the project, spanning two sessions.

**Aug 20, 12:06** — *"dejame las preguntas para hacer en un .md"* → `email-001.md` with the 3
questions, body isolated between `---` for copy-paste, and metadata at the end.

**Aug 20, 14:20** — the user pushes back: *"realmente estas 3 preguntas son necesarias? es como
que encaja muy bien con las 3"*. The answer was to acknowledge the bias: **there were 3 slots and
3 got filled** — anchored on the budget, not on the criterion. The bar I'd used was *"is it
ambiguous?"*; the one the brief sets is *"si alguno te bloquea, pregunta"* [if one of them blocks
you, ask], preceded by *"detectar, decidir, defender"* [detect, decide, defend]. Asking is the
exception. By that bar, none of the three was really blocking.

**Aug 21, 16:46** (session 4, now with Opus) — *"consideras que esta pregunta es la mejor para
hacerles?"* about P-3 (material derived from quality). Verdict: **it's dropped**, failing the
filter written into ADR-002 itself. Rereading the rules together, §1 (*"un atributo que el MTO no
escribe no se rellena con el valor más probable"*) and §5 (*"esta es la única regla de revisión"*)
do settle the case: `A4-70 → INOX` isn't "the most likely value", it's a definitional implication
(ISO 3506 / ISO 898-1). Defensible own judgment → don't ask.

**Result:** 3 questions → **2**, and the third is explicitly saved for the implementation phase.
Afterward, two rewrite passes on the email (*"reescribe el correo pero no lo modifiques en el
archivo"* → *"se puede hacer más corto y meter menos chapa?"*) dropping the selection-criteria
paragraph and reducing each justification to one sentence.

**Pattern:** both times the user pushed back on a deliverable, it was over-sized to fit the
available budget rather than the actual need.

## Phase 4 · Infrastructure and cost (Aug 20, 14:30–14:38)

**Prompt:** *"plantea el sistema para hospedarlo en local pero que podamos arrancar el sistema de
agentes de cloudflare […] ya que no puedo correr en local un modelo de ia"*.

There was a premise mix-up here that needed clearing up before any design: **the agents run on
the laptop, the model doesn't**. Inference is an HTTPS request. Cloudflare wasn't solving any real
problem and would add a deployment, a second point of failure in a 60-minute live demo, and extra
latency. It was dropped.

**Next prompt:** *"podemos usar openai? creo que son mas baratos"*. Allowed by the brief (synthetic
data). But the number that settles the discussion is one of scale, not of rate:

| | |
|---|---|
| Cost of the full case (5 days, ~20–30 runs, demo, blind set) | **< €15** (< €5 with caching) |
| Production, per site | ~€2,500 vs **€87,500** manual baseline |

A provider 30% cheaper saves €4. The decision was made for other reasons and landed in **ADR-003**
with an interface abstracting the provider (`src/lib/llm.ts`), plus **ADR-004** for the on-disk
cache.

## Phase 5 · Verified configuration, not remembered (Aug 21, 16:18–16:20)

**Prompt:** *"Ya tienes en el .env la api key de openai configurada"*.

`OPENAI_MODEL` was empty. Instead of filling it in from memory —model IDs change, and a made-up ID
fails at runtime— `GET /v1/models` was queried with the actual key: 124 accessible models. From
that came `gpt-5.5` (stages with real language) and `gpt-5.4-mini` (iteration and critic
candidate), explicitly ruling out a `gpt-5.6-luna/-sol/-terra` family whose characteristics were
unknown.

Side note: `.env` was `644` → changed to `600`; `git check-ignore` confirmed it was ignored;
`.env.example` still listed Anthropic as the main provider → updated.

## Phase 6 · The coverage matrix (Aug 21, 16:20–16:26)

This piece wasn't in the original plan. It came out of the question *"¿qué más podemos ir
planificando?"* (Aug 20, 14:30) and the following reasoning: **the blind set is 12 rows they
design to test you; if I were designing them, I'd put them exactly where the MTO you're given
doesn't reach.** And that's enumerable today: count which catalog entries the 15 rows **don't**
exercise.

`scripts/cobertura.py` was written to count it, and it confirmed two findings:

1. **The quality equivalence table is never exercised.** The 5 MTO values (`A2`, `A4-70`,
   `A4-80`, `8.8`, `12.9`) are already the canonical ones for their group. The G1–G14 table exists
   precisely to recognize that `304`≡`A2`, `316`≡`A4-70`, `GRADE 5`≡`8.8`. Real coverage: **5 of
   23 values, 5 of 14 groups**. Uncomfortable consequence: a system that ignores the table and
   just copies the value **passes all 15 given rows and crashes on the blind set**. Same with
   standards: 6 of 25 DIN→ISO equivalences.
2. **`VARILLA ROSCADA` never appears**; `HDG`/`GALVANIZADO EN CALIENTE` and `DACROMET` untouched;
   `8` and `10` (the only two catalog values with a special restriction) **loaded and never
   triggered**.

Outputs: `docs/09-coverage-and-blind-set.md` (matrix + blind-set prediction) and a **synthetic set
aimed at the gaps** (`scripts/gen_sintetico.py` → `data/synthetic/`).

## Phase 7 · Deterministic tables (Aug 21, 16:28–16:34)

The LLM-free baseline, which is the number everything else gets measured against.

`text.ts` (folding + alias matcher), `names.ts`, `quality.ts` (14 groups, 23 values,
`areEquivalent`, `checkCoherence`), `standards.ts` (26 DIN→ISO keys + a 6-format parser),
`finish.ts`, `material.ts`, `audit.ts` (provenance of every alias added + baseline).

**Verified: 26/26 tests, clean `tsc --noEmit`.** Node 26 runs TypeScript natively, so the tests
run with `node:test` and **zero** test dependencies.

Two implementation findings that got pinned down with their own tests:

- **`STUD BOLT` contains `BOLT`.** With table-order matching, the MTO's 4 studs would be
  classified as `TORNILLO`. The matcher goes by **longest alias first**.
- Two-letter aliases need word-boundary anchoring (`\b`), or they fire inside other words.

## Phase 8 · Gold set by hand (Aug 21, 16:44–16:51)

Complying with plan principle 1: labeling **before** the pipeline exists. Row by row, applying
the written rules and P-1…P-9, and marking each cell as **CIERTA** [certain] or
**DEPENDIENTE-DE-POLÍTICA** [policy-dependent] (`scripts/gold.py`, `scripts/sens.py` for
sensitivity, `scripts/gold_md.py` for the reviewable view).

15 rows → **30 lines**. **15 resolved (50%) / 15 to review (50%)**. 174 of 210 cells (83%)
deducible from the rules; 36 depend on policy.

**The finding that reshaped the KPI:** the review queue has a single cause.

| Reason | Lines |
|---|---|
| `QUALITY_MISSING` | **13** — and 12 are the secondary element of a set |
| `STANDARD_MISSING` | 5 (overlaps in 4) |
| `QUALITY_TYPE_INCOHERENCE` | 1 |

**87% of the queue is simply that the MTO doesn't write the quality of nuts and washers.** That's
`MISSING_IN_SOURCE`: no model fixes it. **This MTO's autonomy ceiling is 50%, and it isn't set by
the system, it's set by the engineering data.** The commitment to the client can't be *"I resolve
90% of the lines"*, and `docs/02-kpi.md` was rewritten with that distinction.

## Phase 9 · Brand and repo (Aug 21, 16:32–16:43, in parallel)

**Design system** (session 2). Extracted with the Chrome DevTools MCP against `sapira.ai/`,
`/pharo`, and `/industries/transportation-logistics`, reading **`:root` custom properties,
*computed* styles from the real components, and the production CSS (85 KB)** — literal values,
not approximations. Cream background `#efebe6`, warm gray ink `#434240`, a single red accent.
Documented in `docs/design-system/DESIGN-SYSTEM.md` with 3 reference screenshots.

**Repo** (session 3, with Sonnet 5 since it's a mechanical task). Created
`OriolBech/case-ai-engineer-project` as private. Verified `.env.example` carried no secrets
**before** committing, and no push was made until explicitly requested.

---

## How we've worked (recurring patterns)

1. **Verify instead of remember.** Model IDs against the real API, permissions with `ls -la`,
   ignore status with `git check-ignore`, prices without quoting from memory, the PDF extracted
   instead of assumed.
2. **The decision before the artifact.** The stack was fixed before creating the tree; the false
   premise was cleared up before designing the hosting; the gold set was labeled before building
   anything.
3. **Enumerate what's absent.** The biggest leverage point in the case (the coverage matrix) came
   from looking at the **missing** data, not the present data.
4. **Uncomfortable findings are accepted.** The 50% ceiling and dropping the third question both
   cut against the comfortable narrative, and both are written down.
5. **Every ambiguity → a flag, not a behavior.** Single home in `policies.ts`, traced to
   `docs/03-policies.md`.
6. **The model is chosen per task.** Sonnet for the mechanical stuff (git), Opus for judgment (is
   this the right question?).
7. **Nothing irreversible without being asked.** `git init`, yes; commit and push, only when
   requested.

## Status at close

| | |
|---|---|
| ✅ Closed | Requirements, plan, structure, ADR-001..004, coverage + synthetic set, deterministic tables (26/26), gold set, design system, repo |
| 🚧 In progress | `02-kpi` (numbers pending the pipeline), `03-politicas`, `04-arquitectura` |
| ⬜ Pending | Pipeline with LLM (SPEC-002/003/005/006/007), buyer UI, eval harness, `05-resultados`, `06-riesgos`, `07-solucion-objetivo`, `08-no-hecho`, 2-pager |

# 3 · The five materials

The client's catalog has exactly five names (`§3`). There are no others. Everything that appears in
a fastener MTO has to fall into one of these five, or it isn't in this family (`P-9`).

## 3.1 · TORNILLO (bolt/screw)

A piece with a **head at one end and thread at the other**. It goes through the hole and is
tightened with a nut, or threads directly into the part.

```
   ⬢═════════════════       head + partial thread   (DIN 931 / ISO 4014)
   ▲head    ▲plain shank   ▲thread

   ⬢▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨       head + full thread      (DIN 933 / ISO 4017)
```

English: `BOLT`, `SCREW`, `HEX BOLT`, `CAP SCREW`. In the MTO it appears as `BOLT`, `HEX BOLT`,
`Tornillo`.

**The catalog doesn't distinguish subtypes.** A hex bolt (6-sided head, tightened with a wrench) and
a socket-head (Allen) bolt (cylindrical head with an *internal* hexagon, tightened with an Allen
key) are both `TORNILLO`. What differentiates them is the **standard**: ISO 4017 vs ISO 4762. This
is important and counterintuitive for a programmer: the type doesn't carry the shape information,
the standard does. Rows 2, 3, 4, 6, 7, 8, 10, 15.

**Partial thread vs full thread** (important and only visible in the standard): DIN 931 leaves a
plain section next to the head; DIN 933 is threaded from tip to head. They're not interchangeable:
in a shear joint the plain section is a design requirement. Another case of "the relevant detail is
in the standard."

## 3.2 · TUERCA (nut)

A piece with an **internal thread**, no head. It's the counterpart to the bolt or the stud.

```
      ⬡          hexagonal, front view
     ╱ ╲         the central hole is threaded
    │ ○ │
     ╲ ╱
```

English: `NUT`, `HEX NUT`, `HEAVY HEX NUT`. In the MTO: `NUT`, `HEX. NUT`, `Tuerca`, `tuercas`.

**Never carries a length.** A nut has height, not length, and the height is fixed by the standard
for each size. That's why `§7` exempts nuts and washers from the mandatory length field. In the gold
set this is the value `N/A` with `provenance: not_applicable` — which is **not** the same as absent.

Subtypes the catalog doesn't distinguish (all of them are `TUERCA`, differentiated by the standard):
- **standard hex** — DIN 934 / ISO 4032. The usual one.
- **nylon self-locking** — DIN 985 / ISO 10511. Has a nylon ring that grips the thread and prevents
  it from loosening under vibration. Row 13.
- **all-metal self-locking** — DIN 980 / ISO 7042. Same function without nylon, withstands
  temperature.
- **thin / jam nut** — DIN 936 / ISO 4035. Half height, used as a locknut.
- **castle nut** — DIN 935 / ISO 7035. With slots for a safety cotter pin.
- **flange nut** — DIN 6923 / EN 1661. Has a built-in washer.
- **heavy hex** — ASTM A194. Thicker and wider than the metric equivalent; the standard of the
  pressure-piping world. Rows 1 and 5.

## 3.3 · ARANDELA (washer)

A disc with a **central hole with no thread**. It spreads out clamping pressure, protects the
surface, and —in the hardened version— is a load-bearing design element of the joint.

```
      ▁▁▁▁▁▁
    ╱   ○○   ╲    the hole is PLAIN, not threaded
    ╲  ▔▔▔▔  ╱
      ▔▔▔▔▔▔
```

English: `WASHER`, `PLAIN WASHER`, `HARDENED WASHER`. In the MTO: `WASHER`, `Arandela`, `arandelas`.

**Naming trap:** an "M10" washer **does not have an M10 thread**. It means "washer for an M10 bolt,"
with a Ø10.5 mm hole. Same text, different meaning. Row 14.

**Also carries no length** (`§7`), for the same reason as the nut: it has thickness, not length.

Subtypes, again distinguished only by the standard:
- **standard flat** — DIN 125 / ISO 7089. The standard one.
- **wide flat** — DIN 9021 / ISO 7093. Large outer diameter, for sheet metal or soft material.
- **hardened** — ASTM F436. Hardened to 38–45 HRC, mandatory in high-strength structural joints.
  Rows 1 and 5.
- **for wood** — DIN 440 / ISO 7094.

**Why washers have a "grade" in HV.** On the client's grade list `100HV`, `140HV`, `160HV`, `200HV`,
`300HV` appear. `HV` is **Vickers hardness**, and it's *the* way to specify a flat washer: it has no
thread, so it can't have a strength class like `8.8`. See [06-qualities.md](06-qualities.md) and
policy `P-8`.

## 3.4 · ESPARRAGO (stud bolt)

**A rod threaded at both ends** (or its full length), no head, tightened with **a nut on each
side**. It's the flange-joining element.

```
   ▨▨▨▨▨▨═══════════════════════▨▨▨▨▨▨      thread · plain · thread
   ⬡▨▨▨▨▨                       ▨▨▨▨▨⬡      assembled: a nut at each end
```

English: `STUD`, `STUD BOLT`. In the MTO: `STUD BOLT`, `esparrago`. Rows 1, 5, 9, 12.

**Why it exists instead of a long bolt.** In a flange you can't insert a bolt from one side: there's
no access, nor a head to bear symmetrically against. The stud passes through both holes and is
tightened from both sides, which also allows a controlled, symmetric tightening (cross-pattern
torque) and lets nuts be replaced without touching the stud.

**Length is measured thread-to-thread**, not including the nuts. In the ASME world this is *first
thread to first thread*. In practice: `7/8" X 130` mm ≈ 5.1 inches, consistent with a flange —
which is the physical evidence behind `P-4`.

**A stud bolt almost always arrives as a set** (2 nuts + 2 washers per unit, see
[01-what-is-an-mto.md](01-what-is-an-mto.md)). Almost. Row 12 is a bare stud, and it's a reminder that
"STUD BOLT" doesn't imply a set: the text declares the set, not the type.

## 3.5 · VARILLA ROSCADA (threaded rod)

**A bar threaded along its full length**, no head, supplied in bars (typically 1 m) and **cut to
size** on site.

```
   ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨   threaded end to end
```

English: `THREADED ROD`, `ALL THREAD ROD`. Usual standard: **DIN 975** (1 m bar) or DIN 976.

Uses: hanging pipe supports from the ceiling, anchors, joints where the exact length is decided
during assembly.

**Difference from the stud bolt** — and it's the subtlest one in this document:

| | ESPARRAGO (stud bolt) | VARILLA ROSCADA (threaded rod) |
|---|---|---|
| Length | Made to order, set by the purchase order | Standard bar (1 m), cut to size |
| Thread | At the ends, or full length | Always full length |
| Typical standard | ASTM A193/A320, DIN 976 | DIN 975 |
| Purchased | By the piece, with a length | By the bar or by the meter |
| Use | Flange joints | Support structures, anchoring |

**The conflict in row 9.** `Stud bolt set M20 x 200 DIN 975` (Spanish: `Conjunto esparrago M20 x
200 DIN 975`): the word says stud bolt, the standard says threaded rod, and the length (`200 mm`)
says it's a cut piece. It's physically what's done on site —cutting DIN 975 rod to 200 mm and using
it as a stud bolt— but rule `§3` classifies by the word, so it comes out `ESPARRAGO`. The rule is
followed and **the signal is logged**: it's exactly the kind of discrepancy a buyer would look at
twice.

## 3.6 · What is NOT a fastener

Worth keeping in mind because it's the system's worst failure mode (`P-9`). A piping MTO brings, in
the neighboring rows, things that are **not** any of the five:

- **flanges** (`FLANGE`, WN, SO, blind), **gaskets** (`GASKET`, spiral-wound, PTFE)
- **elbows, tees, reducers, caps** (`ELBOW`, `TEE`, `REDUCER`, `CAP`)
- **valves** (`VALVE`: gate, ball, check)
- **pipe** (`PIPE`, by the meter, with a *schedule*)
- **supports**, **pins** (`PIN`), **clamps**, **chemical anchors**, **rivets** (`RIVET`)

A `PIN`, a `RIVET`, or an `ANCHOR BOLT` are especially dangerous because **they look alike**: they
carry a size, a length, and sometimes a DIN standard. If the system forces them into `TORNILLO`, it
produces seven plausible attributes for a material that doesn't exist in the order. That's why
`P-9` prefers a separate queue ("not a fastener, not processed") over a forced fit.

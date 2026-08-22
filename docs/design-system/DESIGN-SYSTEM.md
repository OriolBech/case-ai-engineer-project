# Sapira — Design System

Extracted from **https://sapira.ai/** (home, `/pharo`, `/industries/*`) with Chrome DevTools
on 2026-08-21, by reading the custom properties on `:root`, the computed styles of the
real components, and the production CSS (`_next/static/chunks/0j9cpmj5tvd4p.css`).

Every value in this document is **taken literally from the site**, not approximated.

Local assets in `./assets/`:
- `logo-sapira.svg` — official wordmark (`/logo-negro.svg`), viewBox `0 0 1077.62 471.49`
- `01-hero.png`, `02-layers.png`, `03-industry.png` — visual references

---

## 1. Visual principles

Sapira's branding is **"warm technical paper"**: cream backgrounds, warm gray ink,
a single terracotta-red accent, and **square corners**. What must be respected:

| Principle | Rule |
|---|---|
| **No radii** | `border-radius: 0` on buttons, cards, inputs, tables, and badges. The CSS enforces this with `border-radius: 0 !important` on `.btn-pill`. Only dots/avatars (`50%`) and delta-style pills (`999px`) are rounded. |
| **No soft shadows** | Almost everything is separated by a **1px border**, not a shadow. The only shadows are "brick" (solid offset, see §7) and very subtle floating ones. |
| **A single accent** | Red `#c94d43`. No multicolor palettes: hierarchy comes from a scale of warm grays + red for "what the system did." |
| **Mono for data** | Any figure, amount, code, ID, ETA, or timestamp goes in JetBrains Mono with `font-feature-settings: "tnum"`. |
| **Small-caps overlines** | Section labels at 10–11px, `uppercase`, `.08em`–`.12em` tracking, color `--fg-3`. |
| **Light weights on headlines** | Marketing `h1`/`h2` use `font-weight: 400` with negative tracking. Weight 600/700 is reserved for dense UI. |
| **ERP-style density** | On product screens: 10–13px, rows with 9–12px padding, 1px separators (sometimes `dashed`). |

---

## 2. Color

### 2.1 Canonical tokens (`:root`)

```css
:root {
  /* ---- Accent ---- */
  --sapira-red:        #c94d43;   /* primary accent */
  --sapira-red-hover:  #a83636;
  --sapira-red-soft:   #c94d432e; /* rgba(201,77,67,.18) — badge backgrounds */
  --accent-red:        #c64444;   /* variant used in marketing highlights */

  /* ---- Surfaces (light) ---- */
  --bg-main:           #efebe6;   /* cream, page background */
  --bg-hero:           #f2ede6;
  --bg-card:           #f8f4ef;
  --bg-alt:            #eae5df;
  --surface-default:   #f1efe9;   /* UI surface */
  --surface-elevated:  #f7f4f0;   /* card / card header */
  --surface-sunken:    #e1dfdc;   /* hover, recessed */
  --surface-inverse:   #6b6764;

  /* ---- Text / foreground ---- */
  --fg-1:              #434240;   /* primary ink (marketing uses #494848) */
  --fg-2:              #6b6764;
  --fg-3:              #878482;   /* labels, meta */
  --fg-4:              #aba7a4;   /* placeholder, dim */
  --fg-5:              #c1bbb5;
  --fg-on-dark:        #f7f4f0;
  --fg-on-red:         #ffffff;
  --text-primary:      #494848;
  --text-secondary:    #494848d1; /* 82% */
  --text-muted:        #49484899; /* 60% */
  --text-subtle:       #4948487a; /* 48% */
  --text-ghost:        #49484861; /* 38% */

  /* ---- Borders ---- */
  --border-subtle:     #e1dfdc;
  --border-default:    #d5d1cc;
  --border-strong:     #aba7a4;
  --border-focus:      #434240;
  --border:            #49484824; /* 14% — marketing dividers */

  /* ---- Dark CTA ---- */
  --cta-bg:            #562b2a;   /* dark maroon */
  --cta-text:          #ffffffe6;
  --cta-border:        #ffffff0f;
  --ghost-bg:          #4948480a;
  --ghost-bg-hover:    #49484811;
  --ghost-text:        #494848d1;
  --ghost-border:      #4948485c;
}
```

### 2.2 Dark backgrounds (measured on real sections)

| Use | Color |
|---|---|
| Hero (image + near-black overlay) | `#0f0e0d` |
| Final CTA section | `#6b3533` |
| Footer | `#562b2a` |
| Text on dark | `#efebe6` / `rgba(239,235,230,.85)` / `.6` for secondary |
| Borders on dark | `rgba(239,235,230,.1)` … `.4` |

### 2.3 Semantic state

Sapira is deliberately austere: **it almost never uses green/amber**. Red does double
duty as "accent" and as "attention." The only greens in the CSS:

| State | Color | Where it appears |
|---|---|---|
| OK / compliant | `#2f6b3a` | `.kv.ok > b`, `.f-check.ok`, `.doc-status` |
| OK (dot) | `#4a7a4a` | `.badge-eta .dot.ok` |
| Attention / delta | `var(--sapira-red)` over `#c544440f` or `#c544440a` | `.m-foot-pill.warn`, `.f-match-state.warn` |
| Note / human annotation | background `#f8f4d8`, text `#3a342a` | `.m-stickynote` (post-it) |

> For a buyer panel with confidence levels, the translation that stays faithful to the branding
> is: **high = `--fg-1` (neutral, no color)**, **medium = `--fg-3` + `--border-strong` border**,
> **low/needs review = `--sapira-red`**, **human-validated = `#2f6b3a`**.
> Never a saturated green/amber/red traffic light.

---

## 3. Typography

### 3.1 Families

```css
--font-sans: "DM Sans", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
--font-hand: Caveat, cursive;   /* signatures / handwritten annotations only */
```

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400&family=Caveat:wght@400;500;600&display=swap" rel="stylesheet">
```

`body` base: `DM Sans` / `16px` / `400` / `line-height: 1.375` / `-webkit-font-smoothing: antialiased`.

### 3.2 Weights and tracking

```css
--fw-regular: 400;  --fw-medium: 500;  --fw-semibold: 600;  --fw-bold: 700;
--tracking-tight: -.03em;   /* headlines */
--tracking-wide:   .08em;   /* overlines */
--type-overline:  11px;
```

### 3.3 Real scale (computed values from the site)

| Role | Size / LH | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero `h1` (`.text-hero`) | `70/66/60/54/46/38px` → LH `1.05` | 400 | `-.02em` | responsive scaling per breakpoint; 44px LH 48 in compact variant |
| Section `h2` | `45px / 52px` | 400 | `-.5px` | |
| Large card title | `32px / 40px` | 400 | `-.5px` | |
| Industry card `h3` | `26px / 32px` | 400 | `-.3px` | on dark background |
| Layer `h3` | `24px / 30px` | 400 | `-.3px` | |
| Screen title (`.wf-title`) | `28px / 1.1` | **700** | `-.035em` | product UI |
| Lead / intro `p` | `19px / 28px` | 400 | — | color `--text-muted` |
| Hero lead `p` | `18.7px / 28px` | 400 | — | |
| Body | `16px / 22px` | 400 | — | |
| Dense body / descriptions | `14px / 20px` | 400 | — | 60% color |
| Base UI | `13px / 1.2–1.4` | 500/600 | `-.005em` | buttons, card titles |
| Secondary UI | `12px` | 400/500 | — | values, cells |
| Meta / label | `11px` | 500 | `.04–.06em` | `uppercase` on labels |
| Overline / eyebrow | `10–11px` | 500/600 | `.08–.14em` | `uppercase`, `--fg-3`/`--fg-4` |
| Large metric | `48px` (36px mobile) / LH 1 | **300** | `-1px` | `.metric-number` |
| Figures (mono) | `12–13px` | 400/600 | — | `font-feature-settings:"tnum"` |
| Handwritten signature | `18px / 1` Caveat | 600 | — | |

Reference classes:

```css
.text-hero      { font-size: 66px; line-height: 1.05; font-weight: 400; letter-spacing: -.02em; }
.wf-title       { font-size: 28px; line-height: 1.1;  font-weight: 700; letter-spacing: -.035em; max-width: 640px; }
.eyebrow,
.wf-eyebrow     { font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
                  color: var(--fg-3); font-weight: 500; }
.cs-eyebrow     { font: 600 10px/1.2 var(--font-mono); letter-spacing: .12em;
                  text-transform: uppercase; color: var(--fg-3); }
.metric-number  { font-size: 48px; font-weight: 300; line-height: 1; letter-spacing: -1px;
                  color: var(--text-primary); }
.m-mono         { font-family: var(--font-mono); font-feature-settings: "tnum"; }
```

---

## 4. Layout and spacing

```css
--spacing: .25rem;      /* base scale 4px */
--frame-inset: 50px;    /* section side padding on desktop */
```

| Measurement | Value |
|---|---|
| Marketing content width | `1400px` (`padding-inline: max(50px, 50vw - 700px)`) |
| Application shell width | `1320px`, `padding: 0 40px` |
| Side padding desktop / mobile | `50px` / `24px` |
| Section vertical padding | `64px 0` (`.section-padding`); heroes up to `400px 50px 160px` |
| Topbar height | `64px` (`min-height`), `position: sticky; top: 0` |
| App section gap | `16px` (`.wf-section`), `22px` between panels |
| Card content gap | `6–14px` |
| Divider | `border-top: 1px solid var(--border)` — never thick `<hr>` elements |

Observed spacing rhythm: **4 / 6 / 8 / 10 / 12 / 14 / 16 / 22 / 24 / 32 / 40 / 48 / 64px**.

Typical app grid: main content + side panel →
`grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr); gap: 22px;`

---

## 5. Borders, radii, and elevation

```css
/* Radii — practically everything at 0 */
--radius-none: 0;      /* buttons, cards, inputs, tables, badges */
--radius-dot: 50%;     /* dots, avatars, carousel arrow buttons */
--radius-pill: 999px;  /* ONLY delta chips like .cs-delta */
```

Borders by hierarchy: `--border-subtle` (internal, rows) → `--border-default`
(container) → `--border-strong` (hover/emphasis) → `--sapira-red` (selected/alert).
"Soft" separators use `border-bottom: 1px dashed var(--border-subtle)`.

Shadows (the only ones in the system):

```css
/* "brick" — solid offset; the card sinks when pressed */
--shadow-brick:        0 4px #4948482e, 0 6px 12px #4948480f;
--shadow-brick-hover:  0 1px 4px #4948480a;   /* + transform: translateY(4px) */
--shadow-float:        0 4px 14px rgba(15,14,13,.18);  /* floating buttons */
--shadow-lift:         0 16px 40px #49484814;          /* overlay/modal */
--shadow-note:         0 1px #00000014, 0 4px 8px #4948480f; /* post-it */
--focus-ring:          0 0 0 1px var(--sapira-red);
```

---

## 6. Motion

```css
--ease-standard: cubic-bezier(.4, 0, .2, 1);
--ease-out:      cubic-bezier(0, 0, .2, 1);
--ease-snap:     cubic-bezier(.2, .7, .2, 1);   /* data entrances */
--ease-overshoot: cubic-bezier(.34, 1.56, .64, 1);
--dur-fast: .15s;  --dur-base: .25s;  --dur-slow: .46s;  --dur-bar: .7s;
```

Real patterns:
- Button hover: `transform: translateY(-1px)` + background change, `.25s`.
- "Brick" card: `translateY(4px)` on hover/active with shadow collapse, `.15s`.
- Data row/card entrance: `opacity` + `translateY(8px)` → `0`, `.46s` with `--ease-snap`.
- Comparison bars: `width .7s cubic-bezier(.2,.7,.2,1)`.
- "Live" dot: `animation: 1.6s ease-in-out infinite pulse-dot`.
- `html { scroll-behavior: smooth }` and hidden scrollbars (`scrollbar-width: none`).

---

## 7. Components (literal CSS from the site)

### 7.1 Marketing buttons — `.btn-pill`

```css
.btn-pill {
  display: inline-flex; align-items: center; gap: 6px;
  height: 40px; padding: 0 20px;
  font-family: "DM Sans", sans-serif; font-size: 12px; font-weight: 400;
  border: none; border-radius: 0 !important;
  white-space: nowrap; cursor: pointer; text-decoration: none;
  transition: background-color .25s var(--ease-standard), color .25s, transform .2s;
}
.btn-primary        { background: var(--cta-bg); color: var(--cta-text); border: 1px solid var(--cta-border); }
.btn-primary:hover  { background: #4a2423; transform: translateY(-1px); }

.btn-secondary      { background: var(--ghost-bg); color: var(--ghost-text); border: 1px solid var(--ghost-border); }
.btn-secondary:hover{ background: var(--ghost-bg-hover); transform: translateY(-1px); }

.btn-ghost-white    { background: #efebe61a; color: #efebe6d9; border: 1px solid #efebe640; }
.btn-ghost-white:hover { background: #efebe629; transform: translateY(-1px); }
```

Hero CTA (on dark): primary `background:#efebe6; color:#0f0e0d; 13px/500; padding:0 24px`
(hover `#d9d4ce`); secondary `background:rgba(239,235,230,.1); color:rgba(239,235,230,.8);
border:1px solid rgba(239,235,230,.2)`. Both carry a `›` on the right.

### 7.2 Product buttons — `.wf-btn`

```css
.wf-btn {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px; padding: 0 14px;
  font: 500 13px var(--font-sans); letter-spacing: -.005em;
  background: var(--surface-elevated); color: var(--fg-1);
  border: 1px solid var(--border-default);
  cursor: pointer; transition: all .15s;
}
.wf-btn:hover         { background: var(--surface-sunken); border-color: var(--border-strong); }
.wf-btn.primary       { background: var(--sapira-red); color: var(--fg-on-red); border-color: var(--sapira-red); }
.wf-btn.primary:hover { background: var(--sapira-red-hover); border-color: var(--sapira-red-hover); }
.wf-btn .icon         { display: grid; place-items: center; width: 14px; height: 14px; }
```

Highlighted action variant in forms (`.m-mw-send`): `600 11px` `uppercase`,
`letter-spacing:.06em`, `padding: 9px 16px`, `--sapira-red` background.

### 7.3 Application shell

```css
.wf-root       { background: var(--surface-default); color: var(--fg-1); }
.wf-topbar     { position: sticky; top: 0; z-index: 50;
                 background: var(--surface-default); border-bottom: 1px solid var(--border-default); }
.wf-topbar-inner { display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch;
                   max-width: 1320px; min-height: 64px; margin: 0 auto; padding: 0 40px; }
.wf-logo       { font: 700 22px/1 var(--font-sans); letter-spacing: -.02em; color: var(--fg-1); }

.wf-tab        { padding: 22px 28px 18px; margin-bottom: -1px;
                 font: 500 14px/1 var(--font-sans); letter-spacing: .005em;
                 color: var(--fg-3); background: 0 0; border: 0;
                 border-bottom: 3px solid transparent; cursor: pointer;
                 transition: color .16s, border-color .16s; }
.wf-tab:hover  { color: var(--fg-2); }
.wf-tab.active { color: var(--fg-1); border-bottom-color: var(--fg-1); font-weight: 600; }

.wf-section    { display: grid; grid-template-rows: auto auto 1fr auto; gap: 16px;
                 max-width: 1320px; margin: 0 auto; padding: 22px 40px; }
.wf-section-head { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 24px; }
.wf-stage      { background: var(--surface-elevated); border: 1px solid var(--border-subtle);
                 position: relative; overflow: hidden; }
```

Numeric meta under the title:

```css
.wf-meta-inline { display: flex; align-items: center; gap: 14px; margin-top: 10px;
                  font-family: var(--font-mono); font-size: 12px;
                  font-feature-settings: "tnum"; color: var(--fg-3); }
.wf-meta-inline .wf-num.accent          { color: var(--sapira-red); }
.wf-meta-inline .wf-num.accent::before  { content:""; display:inline-block;
                                          width:6px; height:6px; background: var(--sapira-red); }
```

### 7.4 Generic card

```css
.card          { background: var(--surface-default); border: 1px solid var(--border-default); }
.m-card-head   { display: flex; justify-content: space-between; align-items: flex-start;
                 padding: 12px 16px; border-bottom: 1px solid var(--border-default); }
.m-card-title  { font: 600 13px/1.2 var(--font-sans); color: var(--fg-1); }
.m-card-sub    { font: 500 10px/1.2 var(--font-mono); letter-spacing: .04em;
                 text-transform: uppercase; color: var(--fg-4); margin-top: 4px; }
.m-card-foot   { display: flex; justify-content: space-between; align-items: center;
                 padding: 10px 16px; border-top: 1px solid var(--border-default);
                 background: var(--surface-elevated);
                 font: 500 11px/1.2 var(--font-sans); color: var(--fg-3); }
.m-card-meta   { font: 400 11px/1 var(--font-mono); color: var(--fg-3); }
```

"Brick" card (the only one with real elevation):

```css
.brick-card        { position: relative; transform: translateY(0);
                     box-shadow: 0 4px #4948482e, 0 6px 12px #4948480f;
                     transition: transform .15s var(--ease-standard), box-shadow .15s var(--ease-standard); }
.brick-card:hover  { transform: translateY(4px); box-shadow: 0 1px 4px #4948480a; }
.brick-card:active { transform: translateY(4px); box-shadow: none; }
```

### 7.5 Data table

```css
.m-sheet-table    { width: 100%; border-collapse: collapse;
                    font-family: var(--font-mono); font-size: 12px;
                    font-feature-settings: "tnum"; }
.m-sheet-table th { padding: 8px 12px; text-align: left;
                    font: 600 10px/1.2 var(--font-mono); letter-spacing: .05em;
                    text-transform: uppercase; color: var(--fg-3);
                    background: var(--surface-default);
                    border: 1px solid var(--border-default); }
.m-sheet-table td { padding: 9px 12px; color: var(--fg-1);
                    background: var(--surface-elevated);
                    border: 1px solid var(--border-subtle); }
```

List/rolodex row (grid, not a table):

```css
.m-roll-row         { display: grid; grid-template-columns: 28px minmax(0,1.6fr) 50px minmax(0,1fr);
                      align-items: center; gap: 12px; padding: 10px 16px; font-size: 12px;
                      color: var(--fg-2); border-bottom: 1px dashed var(--border-subtle); }
.m-roll-row:last-child { border-bottom: 0; }
.m-roll-row.ticked  { color: var(--fg-1); background: #c544440a; }  /* row selected by the system */
.m-tick             { font: 700 14px/1 var(--font-mono); color: var(--sapira-red); text-align: center; }
.m-roll-name        { font-weight: 600; }
.m-roll-geo         { font: 600 10px/1 var(--font-mono); letter-spacing: .08em; color: var(--fg-3); }
.m-roll-tag         { font: 500 10px/1 var(--font-mono); letter-spacing: .04em;
                      text-transform: uppercase; color: var(--fg-4); }
```

### 7.6 Key-value list

```css
.m-kv-list  { display: flex; flex-direction: column;
              background: var(--surface-default); border: 1px solid var(--border-default); }
.m-kv       { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
              padding: 9px 12px; font-size: 12px; color: var(--fg-3);
              border-bottom: 1px solid var(--border-subtle); }
.m-kv b     { font: 600 12px/1.2 var(--font-sans); font-feature-settings: "tnum";
              text-align: right; color: var(--fg-1); }
.m-kv.neg b { color: var(--sapira-red); }
.m-kv.ok  b { color: #2f6b3a; }
.m-dim      { color: var(--fg-4) !important; }
```

### 7.7 Badges, pills, and chips

```css
/* neutral table badge */
.badge        { padding: 2px 8px; font-size: 10px; color: var(--fg-3);
                background: var(--surface-elevated); border: 1px solid var(--border-default); }
.badge.fresh  { color: var(--sapira-red); background: var(--sapira-red-soft);
                border-color: var(--sapira-red); font-weight: 600; }

/* status badge with live dot */
.badge-eta        { display: inline-flex; align-items: center; gap: 8px; width: fit-content;
                    padding: 6px 10px; font: 600 12px/1 var(--font-sans);
                    letter-spacing: .02em; text-transform: uppercase; color: var(--fg-1);
                    background: var(--surface-elevated); border: 1px solid var(--border-default); }
.badge-eta .dot   { width: 8px; height: 8px; background: var(--sapira-red);
                    animation: 1.6s ease-in-out infinite pulse-dot; }
.badge-eta .dot.ok{ background: #4a7a4a; animation: none; }
.badge-eta.big    { padding: 10px 14px; font-size: 13px; }
.badge-eta.neg    { border-color: var(--sapira-red); }

/* toggle / filter pill */
.pill      { padding: 6px 10px; text-align: center; font: 600 10px/1 var(--font-sans);
             letter-spacing: .08em; text-transform: uppercase; color: var(--fg-3);
             border: 1px solid var(--border-default); }
.pill.on   { background: var(--sapira-red); color: var(--surface-elevated);
             border-color: var(--sapira-red); }

/* card footer pill */
.m-foot-pill      { padding: 5px 8px; font: 600 10px/1 var(--font-mono); letter-spacing: .1em;
                    text-transform: uppercase; color: var(--fg-3);
                    background: var(--surface-default); border: 1px solid var(--border-default); }
.m-foot-pill.warn { color: var(--sapira-red); background: #c544440f; border-color: var(--sapira-red); }

/* delta chip — the ONLY element with 999px radius */
.cs-delta         { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;
                    font: 700 10px/1 var(--font-mono); letter-spacing: .04em; text-transform: uppercase;
                    color: var(--sapira-red); background: #c94d4314;
                    border: 1px solid #c94d432e; border-radius: 999px; align-self: flex-start; }
.cs-delta::before { content: "▲"; font-size: 8px; line-height: 1; }
.cs-delta.neutral         { color: var(--fg-2); background: #4948480f; border-color: #49484829; }
.cs-delta.neutral::before { display: none; }
```

### 7.8 "Manual vs. System" comparison strip

A highly reusable pattern for showing *before/after* automation:

```css
.comparison-strip { display: grid; grid-template-columns: auto 1fr; align-items: stretch;
                    background: var(--surface-default); border: 1px solid var(--border-default); }
.cs-head   { display: flex; flex-direction: column; justify-content: center; gap: 6px;
             min-width: 130px; padding: 14px 18px;
             background: var(--surface-elevated); border-right: 1px solid var(--border-default); }
.cs-cell   { display: flex; flex-direction: column; gap: 8px; min-width: 0;
             padding: 14px 12px 12px; border-right: 1px solid var(--border-subtle); overflow: hidden; }
.cs-cell:last-child { border-right: 0; }
.cs-label  { font: 500 10px/1.2 var(--font-sans); letter-spacing: .04em;
             text-transform: uppercase; color: var(--fg-4); }
.cs-values { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px;
             font-family: var(--font-mono); font-size: 12.5px; font-feature-settings: "tnum"; }
.cs-sep    { color: var(--fg-5); font-size: 11px; }

/* "manual" state active */
[data-mode="manual"] .cs-manual { color: var(--fg-1); font-weight: 600; }
[data-mode="manual"] .cs-pharo  { color: var(--fg-4); }
/* "system" state active: the manual value gets struck through, the automated one turns red */
[data-mode="pharo"]  .cs-manual { color: var(--fg-4);
                                  text-decoration: line-through #49484866;
                                  text-decoration-thickness: 1px; }
[data-mode="pharo"]  .cs-pharo  { color: var(--sapira-red); }
```

### 7.9 Comparison bars (e.g., quotes / prices)

```css
.s4-bars           { display: flex; flex-direction: column; gap: 11px; }
.s4-bar            { display: grid; grid-template-columns: 110px 1fr 90px;
                     align-items: center; gap: 14px; transition: opacity .3s; }
.s4-bar .label     { font-size: 13px; font-weight: 500; letter-spacing: -.01em; color: var(--fg-1); }
.s4-bar .track     { height: 14px; background: var(--surface-default);
                     border: 1px solid var(--border-default); position: relative; }
.s4-bar .fill      { width: 0; height: 100%; background: var(--fg-3);
                     transition: width .7s cubic-bezier(.2,.7,.2,1); }
.s4-bar.winner .fill { background: var(--sapira-red); }
.s4-bar .price     { font-family: var(--font-mono); font-size: 12px;
                     font-feature-settings: "tnum"; text-align: right; color: var(--fg-2); }
```

### 7.10 Entity card with score and tags

```css
.supplier-card         { padding: 10px 12px; background: var(--surface-default);
                         border: 1px solid var(--border-default); }
.supplier-card.matched { border-color: var(--sapira-red); }
.supplier-card .name   { font-size: 13px; font-weight: 600; letter-spacing: -.01em; color: var(--fg-1); }
.supplier-card .geo    { font-family: var(--font-mono); font-size: 10px; color: var(--fg-3); }
.supplier-card .tags   { display: flex; gap: 4px; margin-top: 6px; }
.supplier-card .tag    { padding: 1px 6px; font-size: 10px; color: var(--fg-3);
                         background: var(--surface-elevated); border: 1px solid var(--border-subtle); }
.supplier-card .score  { font-family: var(--font-mono); font-size: 11px;
                         font-weight: 600; color: var(--sapira-red); }
```

### 7.11 Attachments and document types

```css
.m-attach-icon, .m-pdf, .m-doc { padding: 6px 7px; font: 700 10px/1 var(--font-mono);
                                 letter-spacing: .08em; color: var(--fg-1);
                                 background: var(--surface-elevated); border: 1px solid var(--fg-1); }
.m-pdf          { color: var(--sapira-red); border-color: var(--sapira-red); }
.m-mw-attach    { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px;
                  margin-top: 8px; padding: 10px 12px;
                  background: var(--surface-elevated); border: 1px solid var(--border-default); }
.m-attach-name  { font: 600 12px/1.2 var(--font-sans); color: var(--fg-1); word-break: break-word; }
.m-attach-sub   { font: 500 10px/1.2 var(--font-mono); letter-spacing: .04em;
                  color: var(--fg-4); margin-top: 3px; }
```

### 7.12 "Email"-style window / panel

Useful as a *detail* view for a record (header with mono labels + body):

```css
.m-mailwin       { display: flex; flex-direction: column; align-self: start;
                   background: var(--surface-default); border: 1px solid var(--border-default); }
.m-mailwin-head  { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
                   padding: 8px 12px; background: var(--surface-elevated);
                   border-bottom: 1px solid var(--border-default); }
.m-mw-dots span  { width: 9px; height: 9px; background: var(--border-strong); }
.m-mw-title      { font: 500 11px/1 var(--font-mono); letter-spacing: .06em;
                   text-transform: uppercase; color: var(--fg-3); text-align: center; }
.m-mw-row        { display: grid; grid-template-columns: 80px 1fr; align-items: baseline; gap: 12px;
                   padding: 9px 16px; font-size: 12px; border-bottom: 1px solid var(--border-subtle); }
.m-mw-lab        { font: 500 10px/1.2 var(--font-mono); text-transform: uppercase;
                   letter-spacing: .06em; color: var(--fg-4); }
.m-mw-val        { font: 500 12px/1.4 var(--font-sans); color: var(--fg-1); word-break: break-word; }
.m-mw-body       { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px;
                   font: 500 12px/1.55 var(--font-sans); color: var(--fg-2); }
```

### 7.13 Sticky note (tacit knowledge / human annotation)

The component that best expresses Sapira's narrative ("knowledge that lives in
people's heads"). Ideal for showing an unwritten rule or a buyer's comment:

```css
.m-stickynote { position: relative; padding: 14px 14px 12px;
                background: #f8f4d8; color: #3a342a;
                border: 1px solid #0000000f; transform: rotate(-1.2deg);
                box-shadow: 0 1px #00000014, 0 4px 8px #4948480f; }
.m-sn-pin     { position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
                width: 10px; height: 10px; background: var(--sapira-red);
                border: 1px solid #0003; box-shadow: 0 1px 1px #0003; }
.m-sn-text    { font: 500 13px/1.35 var(--font-sans); font-style: italic; }
.m-sn-cite    { font: 500 10px/1 var(--font-mono); letter-spacing: .06em;
                text-transform: uppercase; color: #3a342a99; margin-top: 8px; }
.pod-signature{ font: 600 18px/1 Caveat, cursive; color: var(--fg-1); margin-top: 4px; }
```

### 7.14 Checks and validation states

```css
.f-check.ok   .f-check-mark { background: #2f6b3a;           color: #fff;
                              border-color: #2f6b3a; }
.f-check.warn .f-check-mark { background: var(--sapira-red); color: var(--fg-on-red);
                              border-color: var(--sapira-red); }
.f-match-state.ok      { background: #2f6b3a0d; border-color: #2f6b3a; }
.f-match-state.warn,
.f-match-state.working { background: #c544440a; border-color: var(--sapira-red); }
.f-approve-eyebrow     { font: 600 10px/1 var(--font-sans); letter-spacing: .14em;
                         text-transform: uppercase; color: var(--fg-4); }
```

### 7.15 Marketing navigation

- Transparent header over the hero, `height: 64px`, no `backdrop-filter`.
- Links: `16px / 600`, color `rgba(239,235,230,.85)` on dark / `--fg-1` on cream.
- Logo as a **CSS mask**, so it recolors with the background:

```css
.logo {
  display: inline-block;
  height: 32px;
  width: calc(32px * (1077.62 / 471.49));   /* SVG ratio */
  background-color: #efebe6;                /* or var(--sapira-red) / var(--fg-1) */
  -webkit-mask-image: url(/logo-sapira.svg); mask-image: url(/logo-sapira.svg);
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-size: contain; mask-size: contain;
}
```

- Carousel arrow button: `border-radius: 50%`, `background: rgba(255,255,255,.92)`,
  `border: 1px solid rgba(73,72,72,.1)`, `box-shadow: 0 4px 14px rgba(15,14,13,.18)`.

---

## 8. Breakpoints

Derived from the jumps in `.text-hero` and the padding overrides:

| Name | Width | Key changes |
|---|---|---|
| `sm` | `< 640px` | side padding `24px`/`20px`, hero `38px`, full-width CTAs stacked, `metric-number` at 36px, visible mobile bottom bar |
| `md` | `≥ 768px` | hero `46px` |
| `lg` | `≥ 1024px` | hero `54px`, 2-column layout |
| `xl` | `≥ 1280px` | hero `60px` |
| `2xl` | `≥ 1536px` | hero `66px` |
| `3xl` | `≥ 1800px` | hero `70px`, `max-width: 1800px` on hero |

Tailwind containers present: `40rem / 48rem / 64rem / 80rem / 96rem`.

---

## 9. Ready-to-copy snippet

Minimal base to get a UI with Sapira's look up and running:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600;700&family=Caveat:wght@400;500;600&display=swap');

:root {
  --sapira-red: #c94d43;  --sapira-red-hover: #a83636;  --sapira-red-soft: #c94d432e;
  --cta-bg: #562b2a;      --cta-text: #ffffffe6;
  --bg-main: #efebe6;
  --surface-default: #f1efe9; --surface-elevated: #f7f4f0; --surface-sunken: #e1dfdc;
  --fg-1: #434240; --fg-2: #6b6764; --fg-3: #878482; --fg-4: #aba7a4; --fg-5: #c1bbb5;
  --fg-on-red: #fff;  --fg-on-dark: #f7f4f0;
  --border-subtle: #e1dfdc; --border-default: #d5d1cc; --border-strong: #aba7a4;
  --ok: #2f6b3a;  --note-bg: #f8f4d8;
  --font-sans: "DM Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;
  --tracking-tight: -.03em; --tracking-wide: .08em;
  --ease-standard: cubic-bezier(.4,0,.2,1); --ease-snap: cubic-bezier(.2,.7,.2,1);
}

* { box-sizing: border-box; border-radius: 0; }

body {
  margin: 0;
  font: 400 16px/1.375 var(--font-sans);
  color: var(--fg-1);
  background: var(--bg-main);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.mono, td, .num { font-family: var(--font-mono); font-feature-settings: "tnum"; }

:focus-visible { outline: none; box-shadow: 0 0 0 1px var(--sapira-red); }

@keyframes pulse-dot {
  0%, 100% { opacity: 1;  transform: scale(1);  }
  50%      { opacity: .4; transform: scale(.8); }
}
```

### Checklist before signing off on a screen

- [ ] No `border-radius` except dots (`50%`) and delta chips (`999px`).
- [ ] All figures in JetBrains Mono with `tnum`.
- [ ] A single accent family: red. No saturated blues, purples, or greens.
- [ ] Every block separated by a 1px border, not a shadow.
- [ ] Every section has its small-caps overline + `.08em` tracking.
- [ ] Headlines at weight 400 (marketing) or 700 with `-.035em` tracking (product), never large 500/600.
- [ ] Cream background (`--bg-main`) on the page, `--surface-elevated` on cards.
- [ ] Button hover = `translateY(-1px)`; brick card hover = `translateY(4px)`.

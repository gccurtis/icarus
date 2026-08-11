# Change record — 2026-07-20 — Design token system + authoritative style spec

Two batches: (1) the Taurus design token system implemented in the stylesheet and
demonstrated on the home page, and (2) restructuring the pulled-in style docs into
a reference tier plus a new authoritative style spec pinned to the code.

## Implemented the full token system in src/app.css

```css
@theme inline {
  --color-canvas: var(--surface-canvas);
  --color-action: var(--role-action);
  --color-intel: var(--role-intel);
  /* …surfaces, text, borders, roles, elevation… */
}
:root, [data-theme='celestial'] { --surface-canvas: #f7f4ec; /* … */ }
[data-theme='eclipse']         { --surface-canvas: #05070a; /* … */ }
```

**Why:** the pulled-in style corpus described a full design language but nothing
was implemented. **Purpose:** expose every design decision (color roles, both
themes, type scale, shell geometry, radii, motion, surfaces) as Tailwind v4
tokens/utilities so future UI is built from a single source of truth rather than
hardcoded values. **Why this way:** `@theme inline` emits live `var()` references
so a single class follows the active theme; concrete values sit in `:root`
(Celestial Light, the default) and `[data-theme='eclipse']` layers, making theme
switching a one-attribute change. Semantic surface classes (`surface-work`,
`surface-panel`, `surface-inspector`, `surface-elevated`, `focus-ring`) and motion
helpers (`dur-*`, `ease-taurus`) round out the reusable vocabulary.

## Defaulted to Celestial Light and rebuilt the showcase page

```svelte
<html lang="en" data-theme="celestial">
<!-- +page.svelte: type scale, semantic states, inspector, live theme toggle -->
```

**Why:** the scaffold booted into a dark placeholder; the design direction
nominates Celestial Light as default. **Purpose:** make the default a real,
implemented choice and give a visual smoke test of the whole token system.
**Why this way:** `data-theme` on the root sets the default; the page exercises
surfaces, the type scale, the six semantic roles (icon + label + color, never
color alone), and a Celestial ↔ Eclipse toggle so both palettes are verifiable.

## Moved the style corpus into the reference tier

```text
docs/style/ (8 docs)  ->  docs/reference/style/   (git mv, history preserved)
```

**Why:** the pulled-in docs are design *direction*, explicitly provisional.
**Purpose:** separate non-authoritative rationale from the authoritative spec.
**Why this way:** `git mv` keeps history; the reference README, its status line,
and the precedence/index links were updated so the corpus now points *up* at the
authoritative spec.

## Created an authoritative docs/style/ (1:1 mirror)

```text
docs/style/{README, color-system, typography-system, surfaces-components-motion,
            aesthetic-mandate, interaction-disclosure, accessibility-usability,
            ai-quarterback-surface}.md
```

**Why:** we need authoritative styling docs with the exact values we actually
use. **Purpose:** the concrete docs enumerate exact hex (both themes), token
names, and Tailwind utility names matching `src/app.css`; the behavioral docs
record our committed stance. **Why this way:** a 1:1 mirror gives every reference
doc an authoritative counterpart; the README defines the authority rules and the
"change token → update doc → record it" loop. AGENTS.md gained a Styling section
pointing here as the source of truth.

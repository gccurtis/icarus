# src/app.css — breakdown

Companion to [app.css](app.css). The global stylesheet and the home of the
**Taurus design token system**. It self-hosts the IBM Plex fonts, imports
Tailwind v4, defines every design token (translated from `docs/style/`), wires
the two theme palettes (Celestial Light default, Eclipse dark), sets accessible
base styles, and exposes reusable semantic surface utilities.

## Font faces

### Self-hosted IBM Plex Sans and Mono weights

```css
/* Self-hosted IBM Plex, loaded from @fontsource (FOSS, offline). */
@import '@fontsource/ibm-plex-sans/400.css';
@import '@fontsource/ibm-plex-sans/500.css';
@import '@fontsource/ibm-plex-sans/600.css';
@import '@fontsource/ibm-plex-mono/400.css';
@import '@fontsource/ibm-plex-mono/500.css';
```

Each `@import` pulls a weight's `@font-face` + bundled `.woff2`, so fonts ship
with the app. Sans 400/500/600 covers body through semibold headings; Mono
400/500 covers technical data. `@import`s lead the file as CSS requires.

## Tailwind and the dark variant

### Import Tailwind and bind `dark:` to the Eclipse attribute

```css

@import 'tailwindcss';

/* Eclipse (dark) activates by attribute; `variant dark` lets `dark:` utilities
   target it instead of the OS preference, since the theme is explicit. */
@custom-variant dark (&:where([data-theme='eclipse'], [data-theme='eclipse'] *));
```

`@import 'tailwindcss'` pulls in Tailwind v4. `@custom-variant dark` redefines
the `dark:` variant to trigger on `[data-theme='eclipse']` rather than the OS
`prefers-color-scheme`, because Taurus chooses its theme explicitly (default is
light) rather than following the system.

## Static design tokens

### Fonts, type scale, shell geometry, radii, and motion

```css

/* -------------------------------------------------------------------------- *
 * Static design tokens — theme-independent. These become Tailwind utilities
 * (font-sans, text-h1, h-topbar, rounded-panel, ease-taurus, …).
 * -------------------------------------------------------------------------- */
@theme {
  /* Font families */
  --font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'Cascadia Code', monospace;

  /* Type scale (size / line-height) — from the typography system. */
  --text-h1: 2.125rem;        --text-h1--line-height: 2.625rem;   /* 34 / 42 */
  --text-h2: 1.75rem;         --text-h2--line-height: 2.25rem;    /* 28 / 36 */
  --text-h3: 1.5rem;          --text-h3--line-height: 2rem;       /* 24 / 32 */
  --text-h4: 1.25rem;         --text-h4--line-height: 1.75rem;    /* 20 / 28 */
  --text-body-lg: 1.125rem;   --text-body-lg--line-height: 1.875rem; /* 18 / 30 */
  --text-body: 1rem;          --text-body--line-height: 1.625rem; /* 16 / 26 */
  --text-body-sm: 0.875rem;   --text-body-sm--line-height: 1.375rem; /* 14 / 22 */
  --text-label: 0.8125rem;    --text-label--line-height: 1.125rem;   /* 13 / 18 */
  --text-caption: 0.75rem;    --text-caption--line-height: 1rem;  /* 12 / 16 */
  --text-mono: 0.8125rem;     --text-mono--line-height: 1.25rem;  /* 13 / 20 */

  /* Shell geometry — from the surface system. Exposed on the spacing scale so
     h-*, w-*, p-*, gap-* all work (e.g. h-topbar, w-inspector). */
  --spacing-topbar: 2.75rem;        /* 44 */
  --spacing-tabstrip: 2.25rem;      /* 36 */
  --spacing-rail: 2.75rem;          /* 44 */
  --spacing-status: 1.5rem;         /* 24 */
  --spacing-qb: 3rem;               /* 48 */
  --spacing-context: 17.5rem;       /* 280 */
  --spacing-context-min: 13.75rem;  /* 220 */
  --spacing-context-max: 23.75rem;  /* 380 */
  --spacing-inspector: 20rem;       /* 320 */
  --spacing-inspector-min: 17.5rem; /* 280 */
  --spacing-inspector-max: 27.5rem; /* 440 */

  /* Radii — squared seams, modest controls, generous overlays. */
  --radius-control: 0.375rem;  /* 6 */
  --radius-panel: 0.625rem;    /* 10 */
  --radius-overlay: 1rem;      /* 16 */

  /* Motion — calm ease-out; durations exposed below as dur-* utilities. */
  --ease-taurus: cubic-bezier(0.2, 0.8, 0.2, 1);
  --motion-micro: 100ms;   /* micro feedback     80–120ms */
  --motion-small: 150ms;   /* small transitions 120–180ms */
  --motion-panel: 220ms;   /* panel changes     180–240ms */
  --motion-overlay: 260ms; /* overlays          200–280ms */
  --motion-theme: 420ms;   /* light/dark cross-fade */
}
```

A Tailwind v4 `@theme` block. Every entry becomes a usable utility: `--font-*`
→ `font-sans`/`font-mono`; the `--text-*` pairs → `text-h1` … `text-mono` (each
carrying its line-height); `--spacing-*` → the shell geometry as `h-topbar`,
`w-inspector`, etc.; `--radius-*` → `rounded-control/panel/overlay`; `--ease-taurus`
→ `ease-taurus`. These tokens are theme-independent — sizes and timings don't
change between light and dark. Values are transcribed from the typography and
surface docs (px shown in comments).

## Semantic color tokens

### Runtime-swappable color roles (`@theme inline`)

```css

/* -------------------------------------------------------------------------- *
 * Semantic color tokens — `inline` so utilities emit the raw var() reference
 * and follow whichever theme is active at runtime.
 * -------------------------------------------------------------------------- */
@theme inline {
  /* Surfaces */
  --color-canvas: var(--surface-canvas);
  --color-work: var(--surface-work);
  --color-panel: var(--surface-panel);
  --color-elevated: var(--surface-elevated);
  --color-selection: var(--surface-selection);

  /* Text */
  --color-primary: var(--text-primary);
  --color-secondary: var(--text-secondary);
  --color-muted: var(--text-muted);

  /* Borders */
  --color-border: var(--border-subtle);
  --color-border-strong: var(--border-strong);

  /* Semantic roles (color is meaning — see usage laws) */
  --color-action: var(--role-action);
  --color-action-fg: var(--role-action-fg);
  --color-focus: var(--role-focus);       /* liveness + focus (Halo Cyan)   */
  --color-intel: var(--role-intel);       /* AI / derived (Vesper Violet)   */
  --color-attention: var(--role-attention); /* judgment / stale (Amber)     */
  --color-success: var(--role-success);   /* applied / safe                 */
  --color-danger: var(--role-danger);     /* failed / destructive           */

  /* Elevation */
  --shadow-panel: var(--elevation-panel);
  --shadow-overlay: var(--elevation-overlay);
}
```

The `inline` modifier makes Tailwind emit the raw `var(...)` reference inside
each utility (e.g. `.bg-canvas { background: var(--surface-canvas) }`) instead of
freezing a value at build time. That indirection is what lets a single class
follow whichever theme is active. Colors are named by **meaning** (`action`,
`intel`, `focus`, `attention`, `success`, `danger`) so usage stays semantic, and
generate the full `bg-*`/`text-*`/`border-*` families.

## Theme value layers

### Celestial Light — the provisional default

```css

/* -------------------------------------------------------------------------- *
 * Theme value layers. `:root` is Celestial Light (provisional default).
 * `[data-theme='eclipse']` is the dark alternate. Values from the color system;
 * brand roles are lightened in Eclipse for contrast, per the accessibility note.
 * -------------------------------------------------------------------------- */
:root,
[data-theme='celestial'] {
  color-scheme: light;

  --surface-canvas: #f7f4ec;
  --surface-work: #fffefa;
  --surface-panel: #eeeae0;
  --surface-elevated: #ffffff;
  /* Text-selection wash — the focus role at low alpha (also held while blurred). */
  --surface-selection: color-mix(in srgb, var(--role-focus) 22%, transparent);

  --text-primary: #1d2329;
  --text-secondary: #3a424d;
  --text-muted: #6c716c;

  --border-subtle: #d8d3c4;
  --border-strong: #b9b3a1;

  --role-action: #3657c9;
  --role-action-fg: #fffefa;
  --role-focus: #0087b8;
  --role-intel: #6f49d8;
  --role-attention: #8a5a13;
  --role-success: #1e7a46;
  --role-danger: #c0362c;

  --elevation-panel: 0 1px 2px rgb(29 35 41 / 0.06);
  --elevation-overlay: 0 12px 32px -8px rgb(29 35 41 / 0.18);
}
```

Bound to `:root`, so Celestial Light is the boot default. It defines the runtime
values the `@theme inline` tokens point at: surfaces (pearl/off-white, not pure
white) and the derived selection wash, text, borders, and the five brand roles at
their documented hex, plus green/red for applied/failed and restrained shadows. Green and red weren't given
explicit hex in the docs, so accessible values were chosen.

### Eclipse — the dark alternate

```css

[data-theme='eclipse'] {
  color-scheme: dark;

  --surface-canvas: #05070a;
  --surface-work: #0b0f14;
  --surface-panel: #111827;
  --surface-elevated: #172033;
  --surface-selection: color-mix(in srgb, var(--role-focus) 22%, transparent);

  --text-primary: #f7f4ec;
  --text-secondary: #d8d3c4;
  --text-muted: #93a0b4;

  --border-subtle: #2a3445;
  --border-strong: #42506a;

  --role-action: #6e8bff;
  --role-action-fg: #05070a;
  --role-focus: #38bdf8;
  --role-intel: #a98bff;
  --role-attention: #e0a93b;
  --role-success: #3dd68c;
  --role-danger: #f2645a;

  --elevation-panel: 0 1px 2px rgb(0 0 0 / 0.4);
  --elevation-overlay: 0 16px 40px -12px rgb(0 0 0 / 0.6);
}
```

Overrides the same variables when `data-theme='eclipse'` is set on the root
element. Surfaces stay dimensional (not pure black), and the brand roles are
**lightened** from their light-theme hex so they keep sufficient contrast on dark
surfaces — the accessibility note in the color system warns that raw palette
values aren't safe in every pairing. `--text-muted` is derived (the docs give no
dark muted value).

## Base layer

### Canvas, type defaults, and a global focus ring

```css

/* -------------------------------------------------------------------------- *
 * Base layer — canvas, type defaults, and a global accessible focus ring.
 * -------------------------------------------------------------------------- */
@layer base {
  html {
    color-scheme: var(--color-scheme);
  }

  body {
    background-color: var(--surface-canvas);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-body);
    line-height: var(--text-body--line-height);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* Every interactive element gets a visible focus perimeter (WCAG 2.2). */
  :where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
    outline: 2px solid var(--role-focus);
    outline-offset: 2px;
    border-radius: var(--radius-control);
  }

  ::selection {
    background-color: var(--color-selection);
  }
}
```

Sets the page onto the canvas surface with IBM Plex body type. The
`:focus-visible` rule gives **every** interactive element a cyan focus perimeter
by default — satisfying the accessibility baseline's "visible keyboard focus"
requirement without per-component work. Selection highlight uses the
`--color-selection` token (a translucent mix of the focus color), shared with the
editor's blurred-selection hold decoration.

### Reduced-motion override

```css

/* Respect reduced-motion: strip choreography, keep state. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/*
 * Smooth the light/dark swap. theme.ts adds `.theme-transition` to <html> only for
 * the duration of a toggle, so colors cross-fade instead of snapping — without
 * transitioning colors during normal interaction. Gated on no-preference so
 * reduced-motion users still switch instantly.
 */
@media (prefers-reduced-motion: no-preference) {
  .theme-transition,
  .theme-transition *,
  .theme-transition *::before,
  .theme-transition *::after {
    transition:
      background-color var(--motion-theme) var(--ease-taurus),
      border-color var(--motion-theme) var(--ease-taurus),
      color var(--motion-theme) var(--ease-taurus),
      fill var(--motion-theme) var(--ease-taurus),
      stroke var(--motion-theme) var(--ease-taurus) !important;
  }
}
```

Honors `prefers-reduced-motion` globally by collapsing animations and
transitions — the motion doc's rule to remove choreography while preserving
state clarity. The second block powers the **light/dark cross-fade**: [theme.ts](lib/theme.ts)
adds `.theme-transition` to `<html>` only while a toggle is in flight, so colors ease
between palettes over `--motion-theme` instead of snapping; it's gated on
`no-preference`, so reduced-motion users still switch instantly.

## Semantic surface utilities

### The reusable structural zones

```css

/* -------------------------------------------------------------------------- *
 * Semantic surface utilities — the reusable structural zones of the shell.
 * Composable with variants and token utilities (e.g. `surface-panel p-4`).
 * -------------------------------------------------------------------------- */
@utility surface-work {
  background-color: var(--surface-work);
  color: var(--text-primary);
}

@utility surface-panel {
  background-color: var(--surface-panel);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

@utility surface-context {
  background-color: var(--surface-panel);
  color: var(--text-secondary);
  border-right: 1px solid var(--border-subtle);
}

@utility surface-inspector {
  background-color: var(--surface-panel);
  color: var(--text-primary);
  border-left: 1px solid var(--border-subtle);
}

@utility surface-elevated {
  background-color: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-overlay);
  box-shadow: var(--shadow-overlay);
}

@utility focus-ring {
  outline: 2px solid var(--role-focus);
  outline-offset: 2px;
}
```

Named `@utility` rules for the shell's structural zones from the surface doc:
`surface-work` (calm center), `surface-panel` (generic bordered panel),
`surface-context` (map-like left rail), `surface-inspector` (right lens),
`surface-elevated` (overlay with radius + shadow), and `focus-ring` for manual
focus styling. Because they're utilities, they compose with variants and other
tokens (`surface-panel p-4 hover:...`). Elevation comes from border + restrained
shadow rather than stacking cards.

### Motion duration helpers

```css

/* Motion duration helpers pairing a calm ease with the standard timings. */
@utility dur-micro {
  transition-timing-function: var(--ease-taurus);
  transition-duration: var(--motion-micro);
}
@utility dur-small {
  transition-timing-function: var(--ease-taurus);
  transition-duration: var(--motion-small);
}
@utility dur-panel {
  transition-timing-function: var(--ease-taurus);
  transition-duration: var(--motion-panel);
}
@utility dur-overlay {
  transition-timing-function: var(--ease-taurus);
  transition-duration: var(--motion-overlay);
}
```

Four convenience utilities that apply the calm `ease-taurus` curve together with
one of the four standard durations (micro/small/panel/overlay). Used with
Tailwind's `transition-*` utilities, they keep motion timing consistent with the
motion doc's guidance without hand-writing durations each time.

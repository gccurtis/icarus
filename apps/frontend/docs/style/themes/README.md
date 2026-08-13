# Themes

A chromatic theme is the system's only source of color values. It is pure
material: it says what colors exist and at what intensities, which end of the
range the interface reads from, and which achromatic family carries the planes
and which carries the text.

**A theme contains no job names.** No `fill`, no `text`, no `border`, no role.
Those are assigned theme-independently in [`system/color/`](../system/color/),
and a theme cannot see them. This is what lets a theme be swapped without
touching a single line of semantics — and what stops a theme from quietly
redefining what `success` means.

## The contract

A theme declares exactly four things and nothing else.

### 1. `color-scheme`

One line, and it is the whole of a theme's light/dark identity:

```css
color-scheme: light;   /* or: dark — or: light dark, to follow the OS */
```

Every `light-dark()` in [slots](../system/color/slots.md) resolves from this.
A theme states which end of its ramps it reads from, once, and the seven purpose
slots re-aim themselves accordingly.

### 2. Thirteen ramps, seven steps each

`--palette-<color>-<step>`, ordered by **lightness** — lightest to darkest. This
is a physical description, not a semantic one: `faded` is pale in every theme,
`deep` is dark in every theme.

| Step | Character |
| --- | --- |
| `faded` | Extreme light. Barely tinted — the palest usable form of the color |
| `light` | Very light. Washes and quiet fills |
| `muted` | The quietest step that still reads unmistakably as the hue |
| `normal` | The base. The most recognizable form of the hue |
| `emphasized` | Darker. Holds up as text on a light ground |
| `strong` | Dark. Small text and dense labels on a light ground |
| `deep` | Extreme dark. The darkest usable form of the color |

The ladder is symmetric about `normal`. Each step has a mirror the same distance
out on the other side — `muted`↔`emphasized`, `light`↔`strong`, `faded`↔`deep` —
which is exactly what lets one slot table serve both directions.

The ten chromatic ramps are `red`, `orange`, `amber`, `yellow`, `green`, `teal`,
`cyan`, `blue`, `violet`, `pink`. The three achromatic ones are `white`, `grey`,
and `black`; they keep their literal names in every theme, because a dark theme
still draws its text from the light family and its planes from the dark one — it
just says so.

### 3. Planes, seams, and text

Which achromatic family does which job. Eleven declarations:

| Token | Use |
| --- | --- |
| `--surface-canvas` | App background — atmospheric field |
| `--surface-work` | Work surface — maximum reading comfort |
| `--surface-panel` | Panel, context, inspector base |
| `--surface-elevated` | Overlays, modals, drawers |
| `--surface-panel-hover` | The neutral hover plane |
| `--border-subtle` | Panel seams, control boundaries, table rules |
| `--border-strong` | Emphasis, active boundaries, dense grid axes |
| `--ink-primary` | Body and headings |
| `--ink-secondary` | Supporting text, recessed panels, provenance |
| `--ink-muted` | Metadata, helper text, timestamps |
| `--ink-on-fill` | Text and icons on a solid role fill |

Borders come from the far end of the theme's own surface family — the seam
between two planes is the same material as the planes, pushed one or two steps.

**The relationships matter more than the values.** The work surface is lifted
above the canvas and the panel is recessed below it, in every theme. On a light
ground "lifted" means lighter; on a dark ground it means lighter too, because
light still comes from above — which is exactly why this is a theme's decision
rather than a mechanical flip of the light theme's choices.

**`--surface-panel-hover` is the neutral hover plane.** A control wearing a
plane rather than a role fill — shadcn's `secondary`, a quiet toolbar button —
becomes this under the pointer. It sits one step from `--surface-panel` in
whichever direction the theme reads as closer: darker in a light theme, lighter
in a dark one. Controls carrying a role fill do not use it; they have their own
[`fill-hover` slot](../system/color/slots.md#the-seven-slots).

**`--ink-on-fill` is not a constant.** It is whatever reads on this theme's
`fill` slot. Celestial's `fill` is the `emphasized` step, so its on-fill is
near-white; Cyberpunk's `fill` is the neon `muted` step, so its on-fill is
near-black. A theme that gets this wrong produces unreadable buttons and nothing
else in the system can correct it.

### 4. A shadow tint

`--shadow-tint` is a single color. The offsets, blur, and opacity live in
[shape](../system/shape.md); shadow is the one geometry family made of color, so
only the color half belongs to a theme.

## What a theme must satisfy

Measured against **its own** work surface, not against white:

- `normal` clears **3:1** — the boundary and non-text UI step.
- `emphasized` clears **4.5:1** — the solid `fill` step, so that `--ink-on-fill`
  is legible on it without a per-hue exception.
- `strong` clears **7:1** — the `text` step.

These hold in the direction the theme reads from. A light theme measures its
`emphasized` against near-white; a dark theme measures its `muted` against its
own dark ground, because that is where `fill` lands when `color-scheme: dark`.

**Every ramp is built to one contract**, so a role maps uniformly across hues
rather than needing a per-hue exception. Where a hue misbehaves, the fix is the
ramp's values — never the mapping, which is not a theme's to change.

## Adding a theme

Copy [`celestial/palette.md`](celestial/palette.md), change the values, write a
`theory.md` saying what the material feels like. Nothing else in the system
moves. A theme adds no semantics and cannot introduce one, which is what keeps
themes from drifting apart.

Adding a color is cheap; adding a step is not. A new hue is one row. An eighth
step changes every ramp in every theme and the slot table besides.

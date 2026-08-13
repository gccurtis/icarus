# Slots

> **Concrete tokens.** Theme-independent. This is the table that turns a ramp
> into usable material, and it is written once for every theme that will ever
> exist.

A **slot** is a job a color does. Seven of them cover every use a role has, and
together they are the reason a component never picks an intensity again: it
picks a job, and the job knows which step it needs.

Token form: `--hue-<color>-<slot>`, as in `--hue-green-fill`.

## The seven slots

| Slot | Job | Sits |
| --- | --- | --- |
| `surface` | The quietest possible wash — zone fills, badge grounds | behind content |
| `surface-hover` | Hover wash, selected row, filled chip | behind content |
| `border` | Boundary, outline, focus perimeter, non-text UI | — |
| `fill` | Solid button, filled badge, saturated marker | behind content |
| `fill-hover` | The hover and pressed state of that solid | behind content |
| `text` | Text and icons on a plain or washed surface | on top |
| `on-fill` | Text and icons on a solid `fill` | on top |

`surface` and `surface-hover` are **surface** slots; `text` and `on-fill` are
**content** slots. A component that puts a content slot behind a surface slot
has the ramp backwards.

## The step table

Both directions live here. `light-dark()` chooses between them from the theme's
own `color-scheme`, so a theme identifies as light or dark in one line and never
names a job.

| Slot | light | dark |
| --- | --- | --- |
| `surface` | `faded` | `deep` |
| `surface-hover` | `light` | `strong` |
| `border` | `normal` | `normal` |
| `fill` | `emphasized` | `muted` |
| `fill-hover` | `strong` | `light` |
| `text` | `strong` | `light` |
| `on-fill` | `--ink-on-fill` | `--ink-on-fill` |

Each direction reaches **five of the seven steps**, and the two sets mirror each
other about `normal`. That symmetry is what the seventh step is for: a light
theme holds `muted` and `deep` in reserve, a dark theme holds `faded` and
`emphasized`, and neither wastes a rung.

`fill-hover` and `text` resolve to the same step. They are still separate slots
because they are separate jobs — one is a background, the other a foreground —
and a theme that needed to pull them apart could do so by tuning its ramp.

## Why `fill` is `emphasized`, not `normal`

This is the one non-obvious choice in the table, and it is forced by arithmetic.

A `normal` step is *defined* as clearing 3:1 against the theme's near-white
ground. That is the same measurement as white text on that step — so white text
on a `normal` fill lands at roughly 3:1 and **fails AA for body text**. Measured
against Celestial's ramps, white on `normal` gives 3.30:1 for orange and teal,
3.46:1 for yellow, 3.72:1 for amber, 3.94:1 for green — eight of eleven ramps
below the 4.5:1 line. Reversing to dark text does not rescue it: a mid-luminance
step is roughly equidistant from both ends, so `green-normal` tops out near
4.0:1 in either direction.

`emphasized` is defined as clearing 4.5:1, which is exactly the guarantee
`on-fill` needs. Every ramp clears it:

| Hue | `on-fill` on `fill` | | Hue | `on-fill` on `fill` |
| --- | --- | --- | --- | --- |
| `green` | 5.30:1 | | `violet` | 7.86:1 |
| `red` | 5.47:1 | | `teal` | 4.93:1 |
| `amber` | 5.86:1 | | `pink` | 5.29:1 |
| `blue` | 8.32:1 | | `grey` | 10.07:1 |
| `cyan` | 5.67:1 | | | |

That uniformity is what lets `--ink-on-fill` be a single theme-level token
rather than a per-hue exception table.

The dark column reaches the same guarantee from the other side. There `fill` is
`muted` — the brightest, most saturated step — so a theme reading dark declares a
**near-black** `--ink-on-fill` and clears 4.5:1 downward instead of upward.
Celestial's on-fill is `#FFFEFA` and Cyberpunk's is `#05030C`, and neither theme
can be derived from the other's choice. This is the clearest reason `on-fill` is
the one slot the theme fills directly: it is the only one whose correct value
depends on which direction the theme reads.

The cost is that a solid control is one step darker than the most saturated
reading of its hue. That is the correct trade: a button whose label cannot be
read is not a more vivid button, it is a broken one.

## Coverage

Slots are declared for the ten chromatic ramps plus `grey` — eleven ramps, 77
declarations. `white` and `black` get none, because they are never a role's
material: they carry planes and text, which the theme assigns directly.

## Rules

- **Nothing outside the role layer references `--hue-*`.** It generates no
  utilities, so a component cannot write `bg-hue-green-fill` even by accident.
- **The table is not a theme's to change.** Where a hue misbehaves in a theme,
  the fix is that ramp's values. A per-theme mapping exception would break the
  uniformity the whole system rests on.
- **Respect the ramp.** `surface` steps go behind content; `text` and `on-fill`
  go on top of it.

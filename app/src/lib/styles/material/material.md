# Material

> What Celestial is made of. What it should feel like is
> [aesthetic](../aesthetic/aesthetic.md). These files hold the only literal
> color values in the repository.

## Two materials, one aesthetic

| Material | Reads | Character |
| --- | --- | --- |
| [**Celestial Helios**](helios/helios.md) | light | the solar will manifest directly — day, warm paper, the source |
| [**Celestial Selene**](selene/selene.md) | dark | the same will returned by another body — night, cool void, reflection |

```css
[data-appearance="helios"] { color-scheme: light; }
[data-appearance="selene"] { color-scheme: dark; }
```

That one declaration re-aims every `light-dark()` in `slots.css`. Helios also
binds bare `:root`, so it is what a page shows before anything is chosen, and
`app.html` sets the attribute in the served markup so the first paint is right.

## They are not required to mirror each other

This is the important structural claim. A material is judged on whether it
expresses Celestial well in its own range, not on whether it is the negative of
the other one. Where Selene reads better with its own value, it declares one,
and no check exists to stop it.

What both materials must satisfy is the *relationships*: the work surface is
nearest the light, the pasteboard is furthest from the page, a boundary is one
step from its ground, and every slot in the table below resolves to something
that clears its contrast floor.

## Shape on disk

```
material/
  ramps.css              the shared ladders — 13 families × 7 steps
  slots.css              intensity → job, resolved by light-dark()
  helios/helios.css      color-scheme, planes, ink, atmosphere
  selene/selene.css      the same, plus the entries Selene overrides
```

`ramps.css` is a starting point, not a constitution. A material redeclares any
`--palette-*` entry it wants; the override lands on the appearance attribute and
the slot table reads it without knowing anything changed.

## Steps

Seven per family, ordered by lightness: `faded`, `light`, `muted`, `normal`,
`emphasized`, `strong`, `deep`. The ladder is symmetric about `normal`, so each
step has a mirror at the same distance on the other side. Each material reaches
five of the seven.

## Slots

The one table that turns a ladder into usable material. Seven jobs per hue; a
component picks a job and never an intensity again.

| Slot | Helios | Selene | Job |
| --- | --- | --- | --- |
| `surface` | `faded` | `deep` | the wash behind content |
| `surface-hover` | `light` | `strong` | hover wash, selected row |
| `border` | `normal` | `muted` | boundary — clears 3:1 |
| `fill` | `emphasized` | `muted` | solid button, filled chip |
| `fill-hover` | `strong` | `light` | hover and pressed solid |
| `text` | `strong` | `light` | text and icons — clears 7:1 |
| `on-fill` | material | material | text on that solid |

`fill` is `emphasized` in Helios, not `normal`: a `normal` step is built to
clear 3:1, so light text on it lands around 3.3–4.2:1 and fails AA for body
text on most ramps. `emphasized` clears 4.5:1 by construction, which is what
makes `on-fill` uniform across hues.

**`border` is the one slot that is not a mirror.** In Selene it reads `muted`
rather than `normal`, and it is the same step as `fill`. `normal` is defined as
"clears 3:1 against near-white", and blue and violet are intrinsically dark at
that step — neither can also clear 3:1 against a near-black plane. Making
`border` appearance-aware costs one line; lifting two named hues would have
cost Aether Blue and Vesper Violet.

## The families

| Family | Job |
| --- | --- |
| ten chromatic ramps | meaning, identity, and categorical work |
| `white` | warm paper. Finely stepped at the light end, where Helios' planes live |
| `black` | cool void — astro navy, dimensional, never flat. Finely stepped at the dark end, where Selene's planes live |
| `grey` | tint-free, spanning the whole range. Carries text and anything that must take no cast |

`white` and `black` name the family, not the step: `white-deep` is a warm
mid-grey and `black-faded` is a cool mid-navy. Neither reaches an absolute — a
citadel at night is a deep sky, not a void.

Text belongs to no surface family, which is why `grey` carries it in both
materials and recedes correctly against either.

## Rules

- **Nothing references `--palette-*` except the slot table and a material's own
  overrides.** A palette token at a call site is a color chosen without a
  reason.
- **A material names no jobs.** If a role name appears in `helios.css` or
  `selene.css`, the layering has broken.
- **Adding a color is cheap; adding a step is not.** A new hue is one row. An
  eighth step changes every ramp and the slot table besides.

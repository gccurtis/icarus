# Celestial — palette

> **Concrete values.** These are the only literal color values in the system.
> Every other color token resolves to one of them.

Celestial's material. What it feels like is [theory](theory.md); what each step
is *for* is [slots](../../system/color/slots.md), which this file does not know
about and may not name.

Token form: `--palette-<color>-<step>`, as in `--palette-blue-normal`.

```css
color-scheme: light;
```

Celestial reads from the light end. That one declaration re-aims every purpose
slot; nothing else in this theme mentions direction.

## Steps

Seven steps per color, ordered by **lightness** — lightest to darkest. The full
step contract is in the [theme contract](../README.md#2-thirteen-ramps-seven-steps-each).

Celestial reaches five of the seven: `faded`, `light`, `normal`, `emphasized`,
`strong`. `muted` and `deep` are the mirror end, carried so the ladder stays
symmetric and so a dark theme has somewhere to read from.

## Chromatic

| Color | `faded` | `light` | `muted` | `normal` | `emphasized` | `strong` | `deep` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `red` | `#FDF1EF` | `#FAD5D0` | `#F2645A` | `#D9483C` | `#C0362C` | `#92251D` | `#5A1611` |
| `orange` | `#FEF4EC` | `#FBDCC2` | `#F08A3C` | `#DD6F1A` | `#A85309` | `#7E3E07` | `#4E2705` |
| `amber` | `#FEF6E8` | `#FAE3B8` | `#E0A93B` | `#B07A15` | `#8A5A13` | `#6B4510` | `#452B09` |
| `yellow` | `#FEFAE6` | `#FAF0B4` | `#E8CE3E` | `#9E8912` | `#7D6C0F` | `#5F520B` | `#3B3307` |
| `green` | `#EFF8F2` | `#C9E8D5` | `#3DD68C` | `#2E9160` | `#1E7A46` | `#145C34` | `#0C3A20` |
| `teal` | `#ECF8F7` | `#C0E6E2` | `#3FCFC0` | `#1F9E92` | `#187D74` | `#115D57` | `#0B3B37` |
| `cyan` | `#EAF6FB` | `#BCE2F2` | `#38BDF8` | `#0087B8` | `#016E96` | `#02597A` | `#013A50` |
| `blue` | `#EEF1FB` | `#CCD6F2` | `#6E8BFF` | `#3657C9` | `#2A45A6` | `#1E3179` | `#131F4B` |
| `violet` | `#F3EFFC` | `#DACFF7` | `#A98BFF` | `#6F49D8` | `#593AAF` | `#412B80` | `#291B50` |
| `pink` | `#FDEFF5` | `#F9CFE1` | `#EE7FAE` | `#DB4A88` | `#BC386F` | `#8E2853` | `#591834` |

Every ramp is built to one contract, so a slot maps uniformly across hues rather
than needing a per-hue exception. Against Celestial's work surface, `normal`
clears 3:1, `emphasized` clears 4.5:1, and `strong` clears 7:1. The yellows and
oranges darken faster through the middle of the ramp than the blues and violets,
which is what it costs to hold that line.

`orange` and `yellow` are claimed by no role. They are the first colors to reach
for when a categorical series needs more than four.

## Achromatic

| Color | `faded` | `light` | `muted` | `normal` | `emphasized` | `strong` | `deep` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `white` | `#FFFFFF` | `#FFFEFA` | `#F7F4EC` | `#EEEAE0` | `#E4DFD2` | `#D8D3C4` | `#B9B3A1` |
| `grey` | `#F2F4F5` | `#D8DDE2` | `#93A0B4` | `#6C716C` | `#3A424D` | `#1D2329` | `#05070A` |
| `black` | `#42506A` | `#2A3445` | `#172033` | `#111827` | `#0B0F14` | `#05070A` | `#000000` |

`white` and `black` name the family, not the step. `white-deep` is a warm
mid-grey and `black-faded` is a cool mid-grey; both are the far end of a ramp
that is anchored at the color it is named for.

## Planes, seams, and text

Which achromatic family does which job. Celestial draws its planes from the warm
paper family and its text from the tint-free one.

| Token | Entry | Value |
| --- | --- | --- |
| `--surface-canvas` | `white-muted` | `#F7F4EC` |
| `--surface-work` | `white-light` | `#FFFEFA` |
| `--surface-panel` | `white-normal` | `#EEEAE0` |
| `--surface-elevated` | `white-faded` | `#FFFFFF` |
| `--surface-panel-hover` | `white-emphasized` | `#E4DFD2` |
| `--border-subtle` | `white-strong` | `#D8D3C4` |
| `--border-strong` | `white-deep` | `#B9B3A1` |
| `--ink-primary` | `grey-strong` | `#1D2329` |
| `--ink-secondary` | `grey-emphasized` | `#3A424D` |
| `--ink-muted` | `grey-normal` | `#6C716C` |
| `--ink-on-fill` | `white-light` | `#FFFEFA` |

`--ink-on-fill` is uniform across every hue because `fill` resolves to the
`emphasized` step, which clears 4.5:1 by construction. No hue needs a dark
on-fill exception.

## Shadow tint

| Token | Entry | Value |
| --- | --- | --- |
| `--shadow-tint` | `grey-strong` | `#1D2329` |

The offsets, blur, and opacity are in [shape](../../system/shape.md). Shadow is
the one geometry family made of color, so only the color half lives here.

## Rules

- **Nothing references `--palette-*` except the slot table.** Components reach
  for a role — `--color-success-text`, `--ink-secondary` — and the role
  resolves. A palette token at a call site is a defect, because it is a color
  chosen without a reason.
- **This file names no jobs.** If a `fill`, a `text`, or a role name appears
  here, the layering has been broken.
- **Adding a color is cheap; adding a step is not.** A new hue is one row. An
  eighth step changes every ramp in every theme and the slot table besides.

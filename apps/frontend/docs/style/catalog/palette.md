# Palette

> **Concrete tokens.** These are the only literal color values in the system.
> Every other color token resolves to one of them.

The palette is a set of absolute ramps. It does not change between themes, it
carries no meaning, and nothing outside a theme layer references it. It exists so
that [Color system](color-system.md) has something to point at.

Token form: `--palette-<color>-<step>`, as in `--palette-blue-normal`.

## Steps

Seven steps per color, ordered by **lightness** — lightest to darkest. This is a
physical description, not a semantic one: `faded` is pale in every theme, `deep`
is dark in every theme.

| Step | Character |
| --- | --- |
| `faded` | Extreme light. Barely tinted — the palest usable form of the color |
| `muted` | Very light. Washes and quiet fills |
| `light` | Light. Reads as the color, comfortably legible on a dark ground |
| `normal` | The base. The most recognizable form of the hue |
| `emphasized` | Darker. Holds up as text on a light ground |
| `strong` | Dark. Small text and dense labels on a light ground |
| `deep` | Extreme dark. The darkest usable form of the color |

The two ends exist for theme headroom. A light theme reads the middle and dark
end of a ramp; a dark theme reads the ends. Without `faded` and `deep`, one theme
or the other runs out of ramp — see
[Color system → Step mapping](color-system.md#step-mapping).

## Chromatic

| Color | `faded` | `muted` | `light` | `normal` | `emphasized` | `strong` | `deep` |
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

The brand hues sit at their natural steps: Aether Blue is `blue-normal`, Vesper
Violet is `violet-normal`, Halo Cyan is `cyan-normal`, and the amber that
carries judgment is `amber-emphasized`.

Every ramp is built to one contract, so a role can map uniformly across hues
rather than needing a per-hue exception: on a near-white ground `normal` clears
3:1, `emphasized` clears 4.5:1, and `strong` clears 7:1. The yellows and oranges
darken faster through the middle of the ramp than the blues and violets, which is
what it costs to hold that line.

## Neutral

Three neutral ramps, because one cannot do the work. A light theme needs six
distinguishable near-whites for its surfaces and seams; a dark theme needs six
distinguishable near-blacks for the same; and text in both themes needs a
tint-free ramp that belongs to neither.

| Color | `faded` | `muted` | `light` | `normal` | `emphasized` | `strong` | `deep` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `white` | `#FFFFFF` | `#FFFEFA` | `#F7F4EC` | `#EEEAE0` | `#E4DFD2` | `#D8D3C4` | `#B9B3A1` |
| `grey` | `#F2F4F5` | `#D8DDE2` | `#93A0B4` | `#6C716C` | `#3A424D` | `#1D2329` | `#05070A` |
| `black` | `#42506A` | `#2A3445` | `#172033` | `#111827` | `#0B0F14` | `#05070A` | `#000000` |

- **`white`** is the warm paper family — pearl and parchment. It occupies the
  light end of the range at high resolution, because that is where a light
  theme's surfaces live and small differences there carry structure.
- **`black`** is the cool void family — astro navy. Same argument at the other
  end: dimensional, never flat, and finely stepped where a dark theme's surfaces
  sit.
- **`grey`** is tint-free and spans the whole range. It carries text in both
  themes and anything that must not pick up a warm or cool cast — dividers,
  disabled states, chart gridlines.

`white` and `black` name the family, not the step. `white-deep` is a warm
mid-grey and `black-faded` is a cool mid-grey; both are the far end of a ramp
that is anchored at the color it is named for.

## Rules

- **Nothing references `--palette-*` except a theme layer.** Components reach for
  a role — `--color-success-normal`, `--ink-secondary` — and the role resolves.
  A palette token at a call site is a defect, because it is a color chosen
  without a reason.
- **The palette is theme-independent.** It is declared once, outside both theme
  layers. Adding a third theme adds mappings, not values.
- **Adding a color is cheap; adding a step is not.** A new hue is one row. A
  ninth step changes every ramp and every mapping.

# Cyberpunk — palette

> **Concrete values.** These are the only literal color values this theme
> contributes. Every other color token resolves to one of them.

Cyberpunk's material. What it feels like is [theory](theory.md); what each step
is *for* is [slots](../../system/color/slots.md), which this file does not know
about and may not name.

```css
color-scheme: dark;
```

Cyberpunk reads from the dark end. That one declaration re-aims every purpose
slot; nothing else in this theme mentions direction.

## Steps

Seven steps per color, ordered by **lightness** — lightest to darkest, exactly
as in every theme. The full step contract is in the
[theme contract](../README.md#2-thirteen-ramps-seven-steps-each).

Cyberpunk reaches five of the seven: `light`, `muted`, `normal`, `strong`,
`deep`. `faded` and `emphasized` are the mirror end, held back exactly as
Celestial holds back `muted` and `deep`.

## Chromatic

| Color | `faded` | `light` | `muted` | `normal` | `emphasized` | `strong` | `deep` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `red` | `#FFECEF` | `#FF9FB0` | `#FF3D6A` | `#D91A4B` | `#A31038` | `#5E0A22` | `#2E0511` |
| `orange` | `#FFF1E6` | `#FFC08A` | `#FF8A2B` | `#D9640F` | `#A34A08` | `#5E2A05` | `#2E1502` |
| `amber` | `#FFF8E6` | `#FFDE8A` | `#FFC22B` | `#D99A0F` | `#A37308` | `#5E4205` | `#2E2002` |
| `yellow` | `#FDFFE6` | `#F2FF8A` | `#E3FF2B` | `#B8D10F` | `#8A9C08` | `#4F5A05` | `#272D02` |
| `green` | `#E9FFF0` | `#8FFFB8` | `#2BFF88` | `#0FD165` | `#089C4A` | `#055A2B` | `#022D15` |
| `teal` | `#E6FFFB` | `#8AFFEE` | `#2BFFDD` | `#0FD1B4` | `#089C86` | `#055A4D` | `#022D26` |
| `cyan` | `#E6FDFF` | `#9FF5FF` | `#22D3EE` | `#0EA5C6` | `#0A7B96` | `#08505F` | `#052A33` |
| `blue` | `#EAF0FF` | `#A8C2FF` | `#6F9DFF` | `#2F74E6` | `#1445A8` | `#0C2760` | `#06132F` |
| `violet` | `#F3EAFF` | `#C9A8FF` | `#A86BFF` | `#8C4AEC` | `#5416A8` | `#300C60` | `#18062F` |
| `pink` | `#FFEAF8` | `#FFA8E0` | `#FF5CC8` | `#E01FA0` | `#A81478` | `#600C44` | `#2F0622` |

Authored for a dark ground rather than derived from Celestial. The ramps are
more saturated through the middle and considerably brighter at the light end,
because a lightness-flipped light theme cannot satisfy the contract below —
sRGB luminance is not symmetric, and a mid-tone that clears 3:1 against
near-white does not clear it against near-black.

## Achromatic

| Color | `faded` | `light` | `muted` | `normal` | `emphasized` | `strong` | `deep` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `white` | `#F2FBFF` | `#DCEEF7` | `#C2DCEA` | `#A3C2D4` | `#7E9BAF` | `#5A7387` | `#3B4C5C` |
| `grey` | `#F4F6F7` | `#D7DDE1` | `#A9B3BA` | `#78838C` | `#4E5860` | `#2E363C` | `#12171A` |
| `black` | `#554E7A` | `#3B3563` | `#262145` | `#1B1734` | `#141027` | `#0D0A1B` | `#05030C` |

- **`black`** is the blue-black city ground. It carries the planes.
- **`white`** is cool signage light. It carries the text.
- **`grey`** is tint-free and spans the whole range.

The names describe the family, not the job — the same three names Celestial
uses, assigned to the opposite jobs. That is what makes them literal rather
than semantic.

## Planes, seams, and text

| `--surface-canvas` | `black-emphasized` | `#141027` |
| `--surface-work` | `black-normal` | `#1B1734` |
| `--surface-panel` | `black-strong` | `#0D0A1B` |
| `--surface-elevated` | `black-muted` | `#262145` |
| `--surface-panel-hover` | `black-emphasized` | `#141027` |
| `--border-subtle` | `black-light` | `#3B3563` |
| `--border-strong` | `black-faded` | `#554E7A` |
| `--ink-primary` | `white-faded` | `#F2FBFF` |
| `--ink-secondary` | `white-normal` | `#A3C2D4` |
| `--ink-muted` | `white-emphasized` | `#7E9BAF` |
| `--ink-on-fill` | `black-deep` | `#05030C` |

`--surface-panel-hover` coincides with `--surface-canvas` here. Seven steps
serving seven jobs will collide somewhere; what matters is that it sits one step
*lighter* than `--surface-panel`, which is the direction this theme reads as
closer to the pointer.

`--ink-on-fill` is near-black, the inverse of Celestial's near-white, because
`fill` resolves to the neon `muted` step in the dark direction.

## Measured against this theme's own ground

Work surface `#1B1734`, on-fill `#05030C`.

| Hue | `text` / work (≥7) | `border` / work (≥3) | `on-fill` / `fill` (≥4.5) |
| --- | --- | --- | --- |
| `red` | 8.89:1 | 3.45:1 | 5.98:1 |
| `orange` | 10.80:1 | 4.74:1 | 8.71:1 |
| `amber` | 13.18:1 | 7.04:1 | 12.69:1 |
| `yellow` | 15.96:1 | 9.98:1 | 18.16:1 |
| `green` | 14.08:1 | 8.47:1 | 15.38:1 |
| `teal` | 14.46:1 | 8.86:1 | 16.05:1 |
| `cyan` | 13.93:1 | 5.92:1 | 11.34:1 |
| `blue` | 9.70:1 | 3.91:1 | 7.75:1 |
| `violet` | 8.64:1 | 3.53:1 | 6.06:1 |
| `pink` | 9.79:1 | 4.00:1 | 7.43:1 |
| `grey` | 12.57:1 | 4.45:1 | 9.61:1 |

Every ramp is built to one contract, so a slot maps uniformly across hues rather
than needing a per-hue exception.

## Rules

- **Nothing references `--palette-*` except the slot table.**
- **This file names no jobs.** If a `fill`, a `text`, or a role name appears
  here, the layering has been broken.

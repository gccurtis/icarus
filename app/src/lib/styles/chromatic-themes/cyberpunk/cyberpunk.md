# Cyberpunk

## Palette contract

> **Concrete values.** These are the only literal color values this theme
> contributes. Every other color token resolves to one of them.

Cyberpunk's material. What it feels like is [theory](#theory); what each step
is *for* is defined by [slots](../chromatic-themes.md), which this file does not know
about and may not name.

```css
color-scheme: dark;
```

Cyberpunk reads from the dark end. That one declaration re-aims every purpose
slot; nothing else in this theme mentions direction.

## Steps

Seven steps per color, ordered by **lightness** — lightest to darkest, exactly
as in every theme. The full step contract is in the
[theme contract](../chromatic-themes.md).

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

| `--theme-surface-canvas` | `black-emphasized` | `#141027` |
| `--theme-surface-work` | `black-normal` | `#1B1734` |
| `--theme-surface-panel` | `black-strong` | `#0D0A1B` |
| `--theme-surface-elevated` | `black-muted` | `#262145` |
| `--theme-surface-panel-hover` | `black-emphasized` | `#141027` |
| `--theme-border-subtle` | `black-light` | `#3B3563` |
| `--theme-border-strong` | `black-faded` | `#554E7A` |
| `--theme-ink-primary` | `white-faded` | `#F2FBFF` |
| `--theme-ink-secondary` | `white-normal` | `#A3C2D4` |
| `--theme-ink-muted` | `white-emphasized` | `#7E9BAF` |
| `--theme-ink-on-fill` | `black-deep` | `#05030C` |

`--theme-surface-panel-hover` coincides with `--theme-surface-canvas` here. Seven steps
serving seven jobs will collide somewhere; what matters is that it sits one step
*lighter* than `--theme-surface-panel`, which is the direction this theme reads as
closer to the pointer.

`--theme-ink-on-fill` is near-black, the inverse of Celestial's near-white, because
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


## Theory

> **What this material feels like.** Sensory and specific. Another theme may
> interpret the [design preferences](../../../../../docs/design-preferences.md) differently and still be correct;
> this is how Cyberpunk interprets it.

Cyberpunk is the dark reading of the citadel: neon signage over a blue-black
city, seen through glass at night. It reads from the dark end of its ramps, so
`color-scheme: dark`, and everything below follows from that one decision.

The mandate warns against "saturated cyberpunk" as a failure mode, and that
warning still holds. What is rejected there is neon *as decoration* — glow
sprayed across chrome to look futuristic. Here the neon is rationed exactly as
Celestial rations color: it appears where meaning appears, and nowhere else. The
citadel is still calm. It is simply lit from within.

## Blue-black, not grey-black

The planes come from a **blue-black** family, not a neutral one. A pure grey
dark theme reads as switched-off; a tinted one reads as a room with light in it.
The family is finely stepped at the dark end, because that is where a dark
theme's surfaces live and small differences there carry structure — the same
argument as Celestial's warm paper, at the other end of the range.

Pure black appears exactly once, at `black-deep`, and it is not a surface: it is
the ink that sits on neon fills, and the shadow tint.

The work surface is **lighter** than the canvas, and the panel is darker than
both. Lift still means lighter — light comes from above in every theme — which
is why the plane assignments are authored rather than flipped.

## Neon is a step, not an effect

Every chromatic ramp is built so its `muted` step is a genuine neon: the
brightest, most saturated form of the hue. That step is what the `fill` slot
resolves to in the dark direction, so a solid control *is* a neon sign, without
any glow, bloom, or shadow being involved.

This forces the one inversion that matters. Celestial's fills are dark and carry
near-white text; Cyberpunk's fills are brilliant and carry near-black text. Both
satisfy the same 4.5:1 contract, from opposite directions, which is precisely
why `--theme-ink-on-fill` belongs to a theme and not to the system.

Glow is still allowed only when it carries state. The saturation here is in the
material, not in a filter.

## The named hues

Cyberpunk names three of its own palette entries:

| Name | Entry | Character |
| --- | --- | --- |
| **Signal Cyan** | `cyan-muted` `#22D3EE` | Cold arc light. The most legible neon on a blue-black ground |
| **Hologram Violet** | `violet-muted` `#A86BFF` | Projected light — present, not solid |
| **Ultra Magenta** | `pink-muted` `#FF5CC8` | The loudest thing the palette can say |

Which of them is primary is not Cyberpunk's decision — that belongs to a
[semantic set](../../semantic-sets/semantic-sets.md). Under
`blue-primary` this theme is cool and institutional; under `cyan-primary` it
becomes arc-lit; under `pink-primary` it becomes a street at night. All three
are the same theme.

## Restraint at the other end

Every ramp reaches seven steps, and Cyberpunk uses five of them. The two it
holds back are `faded` and `emphasized` — the mirror of the two Celestial holds
back. Neither theme has spare capacity; each has a far end it does not read
from.

The temptation specific to a dark theme is to reach for `light` everywhere,
because bright-on-dark always looks confident. That is what the `text` slot is
for, and it is the only slot that gets it. A screen where everything is bright
is a screen with no hierarchy, which fails the review test as surely as a
washed-out one.

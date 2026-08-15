# Celestial

## Palette contract

> **Concrete values.** These are the only literal color values in the system.
> Every other color token resolves to one of them.

Celestial's material. What it feels like is [theory](#theory); what each step
is *for* is defined by [slots](../chromatic-themes.md), which this file does not know
about and may not name.

Token form: `--palette-<color>-<step>`, as in `--palette-blue-normal`.

```css
color-scheme: light;
```

Celestial reads from the light end. That one declaration re-aims every purpose
slot; nothing else in this theme mentions direction.

## Steps

Seven steps per color, ordered by **lightness** — lightest to darkest. The full
step contract is in the [theme contract](../chromatic-themes.md).

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
| `--theme-surface-canvas` | `white-muted` | `#F7F4EC` |
| `--theme-surface-work` | `white-light` | `#FFFEFA` |
| `--theme-surface-panel` | `white-normal` | `#EEEAE0` |
| `--theme-surface-elevated` | `white-faded` | `#FFFFFF` |
| `--theme-surface-panel-hover` | `white-emphasized` | `#E4DFD2` |
| `--theme-border-subtle` | `white-strong` | `#D8D3C4` |
| `--theme-border-strong` | `white-deep` | `#B9B3A1` |
| `--theme-ink-primary` | `grey-strong` | `#1D2329` |
| `--theme-ink-secondary` | `grey-emphasized` | `#3A424D` |
| `--theme-ink-muted` | `grey-normal` | `#6C716C` |
| `--theme-ink-on-fill` | `white-light` | `#FFFEFA` |

`--theme-ink-on-fill` is uniform across every hue because `fill` resolves to the
`emphasized` step, which clears 4.5:1 by construction. No hue needs a dark
on-fill exception.

## Shadow tint

| Token | Entry | Value |
| --- | --- | --- |
| `--theme-shadow-tint` | `grey-strong` | `#1D2329` |

The offsets, blur, and opacity are in [tokens](../../tokens/tokens.md). Shadow is
the one geometry family made of color, so only the color half lives here.

## Rules

- **Nothing references `--palette-*` except the slot table.** Components reach
  for a role — `--token-color-success-text`, `--token-ink-secondary` — and the role
  resolves. A palette token at a call site is a defect, because it is a color
  chosen without a reason.
- **This file names no jobs.** If a `fill`, a `text`, or a role name appears
  here, the layering has been broken.
- **Adding a color is cheap; adding a step is not.** A new hue is one row. An
  eighth step changes every ramp in every theme and the slot table besides.


## Theory

> **What this material feels like.** Sensory and specific. Another theme may
> interpret the [design preferences](../../../../../docs/design-preferences.md) differently and still be correct;
> this is how Celestial interprets it.

Celestial is the light reading of the citadel: pearl and off-white surfaces,
low-glare depth, restrained blue-violet light. It reads from the light end of
its ramps, so `color-scheme: light`, and everything below follows from that one
decision.

## Pearl, not white

The planes come from a **warm paper** family, not a neutral one. Long-form work
should feel like pearl paper or illuminated stone — a surface that has been made
rather than a surface that is merely blank. Pure white appears exactly once, on
the elevated plane, where it reads as light rather than as absence.

The family occupies the light end of the range at high resolution, because that
is where a light theme's surfaces live and small differences there carry
structure. Six distinguishable near-whites are not excessive; they are what a
shell needs to say *this plane is above that one* without drawing a line.

The work surface is **brighter** than the panels around it. The eye should land
on the center without being told to.

## Cool void, tint-free text

Two more achromatic families, because one cannot do the work.

**Black** is the cool void family — astro navy, dimensional, never flat, and
finely stepped at the dark end of the range. Celestial uses it for the shadow
tint and holds the rest in reserve; a dark theme would build its planes from a
family like it.

**Grey** is tint-free and spans the whole range. It carries text and anything
that must not pick up a warm or cool cast — dividers, disabled states, chart
gridlines. Text belongs to no surface family, which is why it recedes correctly
against all of them.

## The named hues

Celestial names three of its own palette entries, because they are what the
product wears:

| Name | Entry | Character |
| --- | --- | --- |
| **Aether Blue** | `blue-normal` `#3657C9` | The affordance. Deep enough to read as structural, saturated enough to read as live |
| **Vesper Violet** | `violet-normal` `#6F49D8` | Derived work. Evening light rather than neon |
| **Halo Cyan** | `cyan-normal` `#0087B8` | Engagement and resolution. The color of something happening now |

The amber that carries judgment is `amber-emphasized` — daylight on stone, not a
warning lamp.

These names describe *this theme's* values. Which of them is primary is not
Celestial's decision — that belongs to a
[semantic set](../../semantic-sets/semantic-sets.md), and under the
default `blue-primary` it is Aether Blue.

## Restraint

Every ramp reaches seven steps, and Celestial uses five of them. The remaining
two — `muted` and `deep` — are not spare capacity to be spent when a screen
feels flat. They are the far end of the ladder, held for the direction Celestial
does not read from.

The same restraint governs saturation. `muted` steps are the most vivid entries
in every ramp and Celestial reaches for none of them, because a light theme that
uses its brightest colors has nowhere left to go when something genuinely needs
attention.

Glow is allowed only when it carries state. Precision, depth, responsiveness,
and restraint create the futuristic character — the future is calm, not neon.

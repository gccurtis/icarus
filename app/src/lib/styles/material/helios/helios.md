# Celestial Helios

> The solar will manifest directly. Day, warm paper, the source. The contract
> both materials satisfy is [material](../material.md).

Helios binds bare `:root` as well as its attribute, so it is what a page shows
before anything is chosen.

## Ladders

Helios uses `ramps.css` unchanged and overrides nothing.

| Color | `faded` | `light` | `muted` | `normal` | `emphasized` | `strong` | `deep` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `red` | `#FDF1EF` | `#FAD5D0` | `#F2645A` | `#D9483C` | `#C0362C` | `#92251D` | `#5A1611` |
| `orange` | `#FEF4EC` | `#FBDCC2` | `#F08A3C` | `#D06816` | `#A85309` | `#7E3E07` | `#4E2705` |
| `amber` | `#FEF6E8` | `#FAE3B8` | `#E0A93B` | `#B07A15` | `#8A5A13` | `#6B4510` | `#452B09` |
| `yellow` | `#FEFAE6` | `#FAF0B4` | `#E8CE3E` | `#998512` | `#7D6C0F` | `#5F520B` | `#3B3307` |
| `green` | `#EFF8F2` | `#C9E8D5` | `#3DD68C` | `#2E9160` | `#1E7A46` | `#145C34` | `#0C3A20` |
| `teal` | `#ECF8F7` | `#C0E6E2` | `#3FCFC0` | `#1D958A` | `#187D74` | `#115D57` | `#0B3B37` |
| `cyan` | `#EAF6FB` | `#BCE2F2` | `#38BDF8` | `#0087B8` | `#016E96` | `#02597A` | `#013A50` |
| `blue` | `#EEF1FB` | `#CCD6F2` | `#6E8BFF` | `#3657C9` | `#2A45A6` | `#1E3179` | `#131F4B` |
| `violet` | `#F3EFFC` | `#DACFF7` | `#A98BFF` | `#6F49D8` | `#593AAF` | `#412B80` | `#291B50` |
| `pink` | `#FDEFF5` | `#F9CFE1` | `#EE7FAE` | `#DB4A88` | `#BC386F` | `#8E2853` | `#591834` |
| `white` | `#FFFFFF` | `#FFFEFA` | `#F7F4EC` | `#EEEAE0` | `#E4DFD2` | `#D8D3C4` | `#B9B3A1` |
| `grey` | `#F2F4F5` | `#D8DDE2` | `#93A0B4` | `#6B7280` | `#3A424D` | `#1D2329` | `#05070A` |

`yellow` is claimed by no role. `orange` carries presentation identity.

## Pearl, not white

The planes come from the **warm paper** family. Long-form work should feel like
pearl paper or illuminated stone — a surface that has been made rather than one
that is merely blank. Pure white appears exactly once, on the elevated plane,
where it reads as light rather than as absence.

The work surface is **brighter** than the panels around it. Six distinguishable
near-whites are not excessive; they are what a shell needs to say *this plane is
above that one* without drawing a line.

## Planes, seams, and text

| `--material-*` | Entry | Value |
| --- | --- | --- |
| `surface-canvas` | `white-muted` | `#F7F4EC` |
| `surface-work` | `white-light` | `#FFFEFA` |
| `surface-panel` | `white-normal` | `#EEEAE0` |
| `surface-panel-hover` | `white-emphasized` | `#E4DFD2` |
| `surface-elevated` | `white-faded` | `#FFFFFF` |
| `surface-pasteboard` | `white-strong` | `#D8D3C4` |
| `surface-inverted` | `grey-strong` | `#1D2329` |
| `border-subtle` | `white-strong` | `#D8D3C4` |
| `border-strong` | `white-deep` | `#B9B3A1` |
| `ink-primary` | `grey-strong` | `#1D2329` |
| `ink-secondary` | `grey-emphasized` | `#3A424D` |
| `ink-muted` | `grey-normal` | `#6B7280` |
| `ink-on-fill` | `white-light` | `#FFFEFA` |
| `ink-on-inverted` | `white-light` | `#FFFEFA` |
| `shadow-tint` | `grey-strong` | `#1D2329` |

## Measured

Contrast against the plane each slot actually sits on: washes and text against
the work surface `#FFFEFA`, boundaries against the panel `#EEEAE0`.

| Hue | wash | hover wash | border ≥3 | fill + on-fill ≥4.5 | text ≥7 |
| --- | --- | --- | --- | --- | --- |
| red | 1.09 | 1.34 | 3.54 | 5.47 | 8.31 |
| orange | 1.07 | 1.29 | 3.08 | 5.33 | 8.07 |
| amber | 1.06 | 1.24 | 3.10 | 5.86 | 8.38 |
| yellow | 1.04 | 1.14 | 3.06 | 5.17 | 7.71 |
| green | 1.07 | 1.30 | 3.28 | 5.30 | 7.97 |
| teal | 1.08 | 1.33 | 3.06 | 4.93 | 7.63 |
| cyan | 1.09 | 1.36 | 3.39 | 5.67 | 7.67 |
| blue | 1.12 | 1.44 | 5.20 | 8.32 | 11.75 |
| violet | 1.12 | 1.46 | 4.83 | 7.86 | 11.06 |
| pink | 1.10 | 1.38 | 3.27 | 5.29 | 8.07 |
| grey | 1.09 | 1.35 | 4.02 | 10.07 | 15.71 |

Ink on the work surface: primary 15.71, secondary 10.07, muted 4.79.

The boundary figures are measured against the **panel**, not the work surface.
The original contract measured them against the work surface only, which is why
orange, yellow, and teal were sitting at 2.75–2.89 on the plane most boundaries
actually occupy. Those three `normal` steps were darkened until they cleared.

## The named hues

| Name | Entry | Character |
| --- | --- | --- |
| **Aether Blue** | `blue-normal` `#3657C9` | the affordance — deep enough to read as structural, saturated enough to read as live |
| **Vesper Violet** | `violet-normal` `#6F49D8` | derived work; evening light rather than neon |
| **Halo Cyan** | `cyan-normal` `#0087B8` | engagement and resolution; the color of something happening now |

The amber that carries judgment is `amber-emphasized` — daylight on stone, not
a warning lamp. Which of these carries which role belongs to
[tokens](../../tokens/tokens.md), not here.

## Restraint

Helios reaches `faded`, `light`, `normal`, `emphasized`, `strong`. The
remaining two are not spare capacity to be spent when a screen feels flat. The
`muted` steps are the most vivid entries in every ramp and Helios reaches for
none of them, because a light material that uses its brightest colors has
nowhere left to go when something genuinely needs attention.

Precision, depth, responsiveness, and restraint create the futuristic
character. The future is calm, not neon.

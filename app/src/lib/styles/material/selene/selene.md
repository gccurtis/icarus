# Celestial Selene

> The same will, returned by another body. Night, cool void, reflection. The
> contract both materials satisfy is [material](../material.md).

Selene is not Helios inverted. It is Celestial expressed in the dark half of
the range, and it declares its own values wherever that reads better.

## What Selene overrides

Three entries, each fixing a place where the shared ladder does not serve the
dark range.

| Entry | Shared | Selene | Why |
| --- | --- | --- | --- |
| `blue-deep` | `#131F4B` | `#1B2C6B` | as a wash behind content on Selene's work plane, the shared value reads 1.04 — invisible. Now 1.27, in line with every other hue |
| `violet-deep` | `#291B50` | `#36246A` | same problem, same fix: 1.07 → 1.27 |
| `grey-strong` | `#1D2329` | `#414B58` | `grey-strong` is Helios' primary ink, so it sits almost exactly on Selene's work plane. As `inactive`'s hover wash it read 1.04 — *fainter than the resting wash it is supposed to be stronger than*. Now 1.86 |

Nothing else diverges. The point is not that Selene is different; it is that
nothing prevents Selene from being different when being the same would be
worse.

## Cool void, reflected light

The planes come from the **black** family — astro navy, dimensional, never
flat, finely stepped at the dark end exactly as `white` is finely stepped at the
light end. It never reaches absolute black.

The work surface is **lighter** than the panels around it, which is the same
claim Helios makes: the work is nearest the light. On a dark ground, nearer the
light means lighter.

Text comes from `grey`, as it does in Helios. Text belongs to no surface family.

## Planes, seams, and text

| `--material-*` | Entry | Value |
| --- | --- | --- |
| `surface-canvas` | `black-emphasized` | `#131925` |
| `surface-work` | `black-normal` | `#181F2E` |
| `surface-panel` | `black-strong` | `#10141E` |
| `surface-panel-hover` | `black-light` | `#253047` |
| `surface-elevated` | `black-muted` | `#1D2639` |
| `surface-pasteboard` | `black-deep` | `#0A0C12` |
| `surface-inverted` | `grey-light` | `#D8DDE2` |
| `border-subtle` | `black-light` | `#253047` |
| `border-strong` | `black-faded` | `#3D4F75` |
| `ink-primary` | `grey-faded` | `#F2F4F5` |
| `ink-secondary` | `grey-light` | `#D8DDE2` |
| `ink-muted` | `grey-muted` | `#93A0B4` |
| `ink-on-fill` | `black-emphasized` | `#131925` |
| `ink-on-inverted` | `black-emphasized` | `#131925` |
| `shadow-tint` | `black-deep` | `#0A0C12` |

`ink-on-fill` is dark because `fill` resolves to the `muted` step here, and
every `muted` step is the most vivid entry in its ramp. Light text on those is
unreadable; this is the inverse of Helios' choice and the reason `on-fill` is a
material decision rather than a slot one.

## Measured

Washes and text against the work surface `#181F2E`, boundaries against the
elevated plane `#1D2639` — the lightest ground a boundary sits on in Selene,
and therefore the tightest.

| Hue | wash | hover wash | border ≥3 | fill + on-fill ≥4.5 | text ≥7 |
| --- | --- | --- | --- | --- | --- |
| red | 1.22 | 1.97 | 4.86 | 5.65 | 12.16 |
| orange | 1.27 | 2.02 | 6.05 | 7.04 | 12.65 |
| amber | 1.26 | 1.95 | 7.14 | 8.30 | 13.14 |
| yellow | 1.30 | 2.12 | 9.60 | 11.17 | 14.27 |
| green | 1.29 | 2.05 | 8.06 | 9.38 | 12.55 |
| teal | 1.33 | 2.14 | 7.85 | 9.13 | 12.29 |
| cyan | 1.35 | 2.13 | 7.06 | 8.21 | 12.01 |
| blue | 1.27 | 1.39 | 4.90 | 5.70 | 11.35 |
| violet | 1.27 | 1.48 | 5.63 | 6.56 | 11.18 |
| pink | 1.26 | 2.02 | 5.96 | 6.94 | 11.80 |
| grey | 1.22 | 1.86 | 5.71 | 6.64 | 12.05 |

Ink on the work surface: primary 14.94, secondary 12.05, muted 6.22.

Every wash now sits between 1.22 and 1.35, and every hover wash is stronger than
the wash it replaces. Blue and violet have the narrowest gap between the two
(1.27 → 1.39 and 1.48), because their `deep` and `strong` steps are close
together; if that proves too subtle in use, it is two more values to move, and
nothing structural stands in the way.

## Restraint

Selene reaches `light`, `muted`, `normal`, `emphasized`, `strong`. It holds
`faded` and `deep` — except where it has replaced `deep` outright, which is the
whole argument of this file.

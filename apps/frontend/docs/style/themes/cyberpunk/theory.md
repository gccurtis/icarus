# Cyberpunk — theory

> **What this material feels like.** Sensory and specific. Another theme may
> interpret the [mandate](../../mandate.md) differently and still be correct;
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
why `--ink-on-fill` belongs to a theme and not to the system.

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
[semantic set](../../system/color/semantic-sets/README.md). Under
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

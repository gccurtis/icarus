# Celestial — theory

> **What this material feels like.** Sensory and specific. Another theme may
> interpret the [mandate](../../mandate.md) differently and still be correct;
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
[semantic set](../../system/color/semantic-sets/README.md), and under the
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

# Light

> The citadel's curves channel light rather than emit it. What that means for
> planes, depth, and atmosphere. The material that carries it is
> [material](../material/material.md).

## Two bodies, one aesthetic

**Celestial Helios** reads from the light end; **Celestial Selene** reads from
the dark. One aesthetic, two materials — Helios the direct manifestation,
Selene the same will returned by another body.

This is why the switch is an **appearance** and not a theme. Nobody is choosing
a different aesthetic. They are choosing which body is doing the lighting.

**The two are not required to mirror each other.** Selene is not Helios
inverted; a photographic negative of a warm paper room is a sickly room. What
carries across is the *relationship* — the work surface is nearest the light,
the pasteboard is furthest from the page, a boundary is one step from its
ground. How each material satisfies those relationships is its own business,
and where Selene is better served by its own value, it declares one.

## Planes

A plane is a claim about distance from the reader. Six of them, and no screen
needs a seventh.

| Plane | What it says |
| --- | --- |
| `canvas` | the ground everything else rests on |
| `work` | the surface the actual work happens on — always nearest the light |
| `panel` | chrome that flanks the work: context, inspector, bars |
| `panel-hover` | the neutral hover plane, one step nearer than `panel` |
| `elevated` | something floating clear: popover, menu, dialog |
| `pasteboard` | the void a document floats in; furthest from the page |

**The work surface is nearest the light in both materials.** The eye should
land in the centre without being told to. Chrome recedes by being further from
the light, never by being greyer.

Planes are separated by lightness, not by lines. A shell that needs a border to
say *this is a different region* has not made the planes do their work. Lines
belong to seams inside a region — see [arrangement](arrangement.md).

## Atmosphere

The canvas is not flat. It carries a very low-amplitude wash — two wide radial
gradients, violet and cyan, at a few percent — so that the ground reads as air
rather than as paint.

This is the cloud in the sentence doing literal work, and it is the one place
the formlessness of the citadel is expressed by the system itself rather than
by a component. It has to stay under the threshold where a person could point
at it. The moment someone notices a gradient, it is too strong.

Selene runs it slightly warmer in amplitude than Helios, because a dark ground
absorbs more of it before it reads.

## Depth is a claim, not a decoration

Three elevations, because three are used: something resting slightly above its
plane, something floating clear of it, something passing beneath something
else.

Shadow is the only geometry family made of colour, so it is split by domain:
the material owns the tint, the tokens own the strength, and shape owns the
offsets and blur. A shadow follows the appearance without any component knowing
which body is lighting it.

A shadow that does not correspond to a real difference in distance is noise.
Two panels on the same plane do not get different shadows to look
"hierarchical"; they are the same distance away, and saying otherwise is a lie
the eye can detect.

## Curvature

Corners are where formlessness is actually spent. Three radii — control, panel,
overlay — and the rule is that a radius names what a thing *is*, never how
important it is.

The one asymmetric shape in the system is the attached block: a rail on the
leading edge and radius on the other three corners, which says *this is joined
to the flow beside it* rather than *this is a separate object*. See
[arrangement](arrangement.md).

## Glow

Glow is the one place the citadel is allowed to look like astro-tech, and it is
rationed to a single job: **glow carries state and nothing else.** Something
live, resolving, or engaged may glow. A resting control may not, a heading may
not, and a panel may not glow to look important.

Its smallest form is a dot with a halo ring — the whole discipline compressed
into six pixels.

## The veil

Chrome that floats over scrolling content — a sticky bar, a rail header — takes
the canvas at partial opacity with a blur behind it, rather than a solid fill.
Solid chrome over moving content reads as a lid; a veil reads as glass, and the
content continuing underneath is what tells a person the region is still there.

## Inversion

One plane is the deliberate opposite of the page: a block that takes the ink
colour as its ground and the ground colour as its ink. It is for the one or two
places on a screen that must read as a statement rather than as a region — a
summary that concludes something, a gate that must be acknowledged.

It is a strong move and it does not survive repetition. Two inverted blocks on
a screen is one too many; the second one costs the first its meaning.

## Tokens this justifies

| Token | Job |
| --- | --- |
| `--token-surface-canvas` … `--token-surface-pasteboard` | the six planes |
| `--token-atmosphere` | air at the ground level |
| `--token-surface-inverted`, `--token-ink-on-inverted` | the deliberate opposite |
| `--token-surface-veil`, `--token-blur-veil` | glass over moving content |
| `--token-surface-selection` | derived from the engaged hue, so it follows the room |
| `--token-shadow-ambient`, `-cast`, `-occlusion` | what a shadow is doing |
| `--token-shadow-panel`, `-raised`, `-overlay` | the three earned elevations |
| `--token-shadow-glow` | state, and only state |
| `--token-radius-control`, `-panel`, `-overlay` | curvature by what a thing is |
| `--token-border-subtle`, `--token-border-strong` | seams, not region boundaries |

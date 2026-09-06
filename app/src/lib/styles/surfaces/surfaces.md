# Surfaces

> The named arrangements a screen is built out of. Tokens are values; surfaces
> are the compositions those values were bought for.

A token tells you a seam is one pixel and the subtle border color. It does not
tell you that a group of cells laid on that color with one-pixel gaps reads as
one object with internal structure, while the same cells with individual borders
read as a pile. That second thing is the actual design decision, and until it
had a name every screen re-derived it — usually differently.

Everything here is declared in `@layer components`, so a Tailwind utility always
wins over a recipe. A surface is a starting point a component may override, not
a style it is trapped in.

**Every class carries the `surface-` prefix, and the prefix is not optional.**
These rules are global — they apply to any element wearing the name, in any
component, regardless of Svelte's scoping. A bare `.rail` here would paint the
context panel's own `<nav class="rail">`, and did: the icon strip turned blue
with a stripe and a rounded corner, in a component that never imported anything.
The prefix is what makes a recipe reachable on purpose and unreachable by
accident. A component's own class names stay its own.

Every recipe below has its argument in [arrangement](../aesthetic/arrangement.md)
or [light](../aesthetic/light.md). Nothing here introduces a value.

| Class | What it composes | Argument |
| --- | --- | --- |
| `.surface-eyebrow` | mono, micro, caps tracking, uppercase, role color | [type](../aesthetic/type.md) — an eyebrow labels the structure rather than joining the prose |
| `.surface-seam-grid` | one ground, hairline gaps, one outer border and radius | [arrangement](../aesthetic/arrangement.md) — seams, not boxes |
| `.surface-rail` | leading rail, squared on that edge, radius on the other three | [arrangement](../aesthetic/arrangement.md) — attached to the flow, not separate from it |
| `.surface-rail-attention`, `.surface-rail-intelligence`, `.surface-rail-quiet` | the same shape in another role | " |
| `.surface-veil` | canvas at partial opacity over a blur | [light](../aesthetic/light.md) — glass over moving content, not a lid |
| `.surface-inverted` | ink as ground, ground as ink | [light](../aesthetic/light.md) — a statement, not a region. One per screen |
| `.surface-live-dot` | a dot with a halo ring | [light](../aesthetic/light.md) — the glow discipline at its smallest |
| `.surface-data-table` | header on its own plane; key column left with a seam; the rest centred and tabular | [arrangement](../aesthetic/arrangement.md) — distinction is communication |
| `.surface-table-frame`, `.surface-table-scroll` | the border, radius and overflow a table sits in | " |

## Composing, not extending

A recipe is meant to be combined and adjusted, not subclassed. `.surface-seam-grid`
sets no column count, because how many columns a group has is a claim about the
content and belongs to the screen. `.surface-rail` sets no padding, because a callout
and a quoted paragraph want different insets. Each recipe carries only the part
that is the same everywhere, which is why they are short.

When a screen needs an arrangement that isn't here and the composition is
genuinely reusable, add it — that is what this directory is for. When it is
specific to one view, it stays with the view.

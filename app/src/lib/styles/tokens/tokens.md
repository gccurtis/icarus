# Tokens

> The complete framework-independent styling API. Everything a component may
> name, and nothing it may not. Canonical names begin with `--token-`; a token
> names a reusable visual **job**, never a hue, an intensity, a component, a
> route, or an external framework concept.

| File | Public surface |
| --- | --- |
| `color.css` | roles, planes, ink, borders, and shadow color |
| `typography.css` | faces, weights, the type scale, leading, and tracking |
| `space.css` | the spacing unit, control heights, and measure |
| `shape.css` | radii, hairline, rail, focus geometry, blur, and shadows |
| `motion.css` | durations, curves, and travel distance |

Components use the most specific job available: `--token-color-danger-text`,
not a red value; `--token-radius-panel`, not a literal radius. View-specific
dimensions stay with their rendered owner.

Nothing here names an application, a feature, or a screen.

## Roles

A role is a direct alias onto one chromatic family across all seven slots. This
table is the only place a hue is chosen.

| Kind | Role | Hue | Means |
| --- | --- | --- | --- |
| Meaning | `success` | green | applied, accepted, valid, safe |
| Meaning | `danger` | red | failed, rejected, destructive, denied |
| Meaning | `attention` | amber | human judgment required; stale; pending review |
| Meaning | `inactive` | grey | unavailable, disabled, or out of scope |
| Identity | `interactive` | blue | can be acted upon: controls, links, focus |
| Identity | `active` | cyan | currently engaged, selected, live, resolving |
| Identity | `intelligence` | violet | derived work: prompts, memory, formulas |
| Brand | `primary` | blue | what the product wears when nothing is more specific |
| Brand | `secondary` | cyan | the quieter alternative |
| Brand | `accent-1` | pink | categorical work |
| Brand | `accent-2` | teal | categorical work |
| Brand | `slide` | orange | presentation identity, wherever a resource kind needs a hue |

Meaning roles are fixed — a person who learnt that red means danger learnt it
everywhere. Identity and brand roles may share a hue with one another but never
with a meaning hue. `yellow` is declared by the material and reserved; `orange`
gives presentation identity a stable public role.

**The material owns what its green *is*. It does not own what green *means*.**

## Planes and ink

Surfaces, ink, and borders carry no hue: they alias the material's achromatic
jobs directly. The six planes, the inverted plane and the atmosphere are
described in [light](../aesthetic/light.md). Selection is derived rather than
authored, so it tracks the engaged hue.

**The material owns what its green *is*. It does not own what green *means*.**
Helios and Selene may hold different values behind the same token; nothing above
this layer can tell, and nothing above this layer should be able to.

Tokens are values. The compositions they were bought for — the seam grid, the
attached block, the veil, the table conventions — are named in
[surfaces](../surfaces/surfaces.md).

## Shadow

Named by what a shadow does, not by how dark it is. The material supplies the
tint, `color.css` decides each strength, and `shape.css` composes the offsets
and blur against them.

| Token | Job |
| --- | --- |
| `--token-shadow-ambient` | diffuse; something rests slightly above its plane |
| `--token-shadow-cast` | directional; something floats clear of its plane |
| `--token-shadow-occlusion` | contact; something passes beneath something else |

## What is new, and where its argument lives

The color layer was complete; everything above it was being invented at each
call site. These are the jobs that had no name.

| Token | Argument |
| --- | --- |
| `--token-tracking-*` | [type](../aesthetic/type.md) — large type at default tracking reads as unset, and uppercase without tracking is unreadable |
| `--token-text-display`, `--token-text-micro` | [type](../aesthetic/type.md) — one statement per page; three fine steps for panel chrome |
| `--token-font-reading`, `--token-reading-leading` | [type](../aesthetic/type.md) — a document set in the interface font reads as part of the application |
| `--token-weight-*` | [type](../aesthetic/type.md) — three weights are loaded; a fourth is synthesized |
| `--token-measure-*` | [type](../aesthetic/type.md) — line length was composed everywhere and named nowhere |
| `--token-control-height-*` | [arrangement](../aesthetic/arrangement.md) — three densities, one per region |
| `--token-hairline`, `--token-rail` | [arrangement](../aesthetic/arrangement.md) — seams instead of boxes; an attached block instead of a card |
| `--token-surface-inverted`, `--token-ink-on-inverted` | [light](../aesthetic/light.md) — the deliberate opposite of the page |
| `--token-surface-veil`, `--token-blur-veil` | [light](../aesthetic/light.md) — glass over moving content, not a lid |
| `--token-atmosphere` | [light](../aesthetic/light.md) — the ground reads as air rather than as paint |
| `--token-shadow-glow` | [light](../aesthetic/light.md) — glow carries state and nothing else |
| `--token-focus-width`, `--token-focus-offset` | [states](../aesthetic/states.md) — there is exactly one focus language |
| `--token-ease-arrival`, `--token-motion-arrival` | [motion](../aesthetic/motion.md) — the system causing something is a second kind of causation |
| `--token-motion-rise`, `--token-motion-drift` | [motion](../aesthetic/motion.md) — things rise, they do not fly |

A token with no argument behind it in one of those documents is a value nobody
decided.

## Dependencies

The color layer may read the material and the slot table. The other four
domains are independent, except that shape composes against shadow color. No
token depends on an integration.

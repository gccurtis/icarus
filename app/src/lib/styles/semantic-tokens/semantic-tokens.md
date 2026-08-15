# Semantic Tokens

Semantic tokens are the complete framework-independent styling API. Canonical
names always begin with `--token-`; a token names a reusable visual job rather
than a hue, intensity, component, route, or external framework concept.

| File | Public surface |
| --- | --- |
| `color.css` | roles, surfaces, ink, borders, and shadow color |
| `typography.css` | font families, type scale, and paired line heights |
| `spacing.css` | the shared four-pixel spacing unit |
| `shape.css` | control, panel, and overlay radii and shadows |
| `motion.css` | durations and the standard easing curve |

Components use the most specific semantic job available. They use
`--token-color-danger-text`, not a red value; `--token-radius-panel`, not a
literal radius. View-specific dimensions stay with their rendered owner.

## Roles

A role is a direct alias onto one chromatic family across all seven job slots.
This table is the only place a hue is chosen.

| Kind | Role | Hue |
| --- | --- | --- |
| Meaning | `success` | green |
| Meaning | `danger` | red |
| Meaning | `attention` | amber |
| Meaning | `inactive` | grey |
| Identity | `interactive` | blue |
| Identity | `active` | cyan |
| Identity | `intelligence` | violet |
| Brand | `primary` | blue |
| Brand | `secondary` | cyan |
| Brand | `accent-1` | pink |
| Brand | `accent-2` | teal |

Meaning roles are fixed. Identity and brand roles may share a hue with one
another but never with a meaning hue. `orange` and `yellow` are declared by the
chromatic stage and reserved.

## Shadow color

Named by what the shadow does, not by how dark it is. The theme supplies the
tint; this layer decides each strength.

| Token | Job |
| --- | --- |
| `--token-shadow-ambient` | diffuse; something rests slightly above its plane |
| `--token-shadow-cast` | directional; something floats clear of its plane |
| `--token-shadow-occlusion` | contact; something passes beneath something else |

Geometry belongs to `shape.css`, which composes offsets and blur against these.

The color layer may depend on private theme and chromatic values. Other token
domains are independent except that shadows may use the theme's private tint.
No token depends on an integration.

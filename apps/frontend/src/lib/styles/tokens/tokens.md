# Tokens

Tokens are the complete framework-independent styling API. Canonical names
always begin with `--token-`; a token names a reusable visual job rather than a
hue, intensity, component, route, or external framework concept.

| File | Public surface |
| --- | --- |
| `color.css` | fixed meaning, semantic identity, surfaces, ink, and borders |
| `typography.css` | font families, type scale, and paired line heights |
| `spacing.css` | the shared four-pixel spacing unit |
| `shape.css` | control, panel, and overlay radii and shadows |
| `motion.css` | durations and the standard easing curve |

Components use the most specific semantic job available. They use
`--token-color-danger-text`, not a red value; `--token-radius-panel`, not a
literal radius. View-specific dimensions stay with their rendered owner.

The color layer may depend on private theme, chromatic, and semantic values.
Other token domains are independent except that shadows may use the theme's
private tint. No token depends on an integration.

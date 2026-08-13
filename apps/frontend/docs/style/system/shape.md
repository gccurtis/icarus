# Shape

> **Concrete tokens.** Corners, depth, and the compositions they produce.
> Geometry is identical in every theme; the one color inside it —
> `--shadow-tint` — belongs to the theme.

One file rather than a theory/component pair: the stance runs a dozen lines and
is tied directly to the tables it governs.

Depth here is **structural, not decorative** — it tells a user which plane they
are on, not that the designer owned a shadow tool. The shell should feel like a
luminous instrument: calm central work, precise panels, obvious boundaries.

## Radii

Squared precision for grids and page seams; modest radii for controls and live
objects; larger radii only for things that genuinely float. Soft, not bubbly.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-control` | 6px / 0.375rem | Buttons, inputs, chips, tags |
| `--radius-panel` | 10px / 0.625rem | Panels, cards, live-object blocks |
| `--radius-overlay` | 16px / 1rem | Modals, popovers, drawers, elevated overlays |

Structural seams — the boundary between context and work, a table rule, a tab
strip edge — are **square**. Rounding a structural seam makes the shell look like
a collection of widgets instead of one instrument.

## Planes and seams

The colors are the theme's, enumerated in the
[theme contract](../themes/README.md#3-planes-seams-and-text). What each plane
is *for*:

| Plane | Character |
| --- | --- |
| Canvas | The atmospheric field the app sits in. Low contrast, recedes completely |
| Work | The reading and editing plane. Maximum comfort, minimum interference |
| Panel | Context, inspector, and cards. Slightly recessed; supports the center |
| Elevated | Overlays, modals, popovers, drawers. The only plane that floats |
| Panel hover | What a plane-colored control becomes under the pointer |

The work surface is lifted above the canvas and the panel is recessed below it,
in every theme. The eye should land on the center without being told to.

**The hover plane is for controls that carry no role fill** — a quiet secondary
button, a toolbar item. It sits one step from `--surface-panel` in whichever
direction its theme reads as closer to the pointer. A control carrying a role
fill ignores it and uses that role's
[`fill-hover` slot](color/slots.md#the-seven-slots) instead, which is what keeps
a primary button's hover tied to its own hue rather than to the furniture.

## Shadows

Geometry here, tint in the theme. Shadow is the one geometry family made of
color, which is why it is the only split token in the system.

| Token | Composition |
| --- | --- |
| `--shadow-panel` | `0 1px 2px` at 6% `--shadow-tint` |
| `--shadow-overlay` | `0 12px 32px -8px` at 18% `--shadow-tint` |

## Elevation levels

Four levels, each a fixed combination. A surface picks one; it does not invent a
fifth.

| Level | Composition |
| --- | --- |
| Flat | Background only. The canvas and the work surface |
| Bounded | Background + 1px `--border-subtle`. Panels, inputs, table containers |
| Raised | Background + border + `--shadow-panel`. Cards that must read as separable |
| Floating | `--surface-elevated` + border + `--radius-overlay` + `--shadow-overlay`. Overlays and drawers |

Two laws govern elevation:

- **Depth is earned by behaviour.** A surface floats only if it can be dismissed.
  If it cannot be closed, it is part of the layout and should be bounded.
- **Never a stack of cards.** Nesting raised surfaces inside raised surfaces
  destroys the plane hierarchy. One level of separation is almost always enough;
  two is the hard limit.

## Named recipes

The reusable compositions. They exist so a panel is defined once rather than
reassembled from tokens at each call site, and so renaming a role touches one
place.

| Recipe | Composition |
| --- | --- |
| `surface-work` | `--surface-work` background, `--ink-primary` text |
| `surface-panel` | `--surface-panel` background, `--ink-primary` text, 1px `--border-subtle` |
| `surface-context` | `--surface-panel` background, `--ink-secondary` text, 1px `--border-subtle` on the right edge |
| `surface-inspector` | `--surface-panel` background, `--ink-primary` text, 1px `--border-subtle` on the left edge |
| `surface-drawer` | `--surface-elevated` background, `--ink-primary` text, 1px `--border-subtle` on the left edge, `--shadow-overlay` |
| `surface-elevated` | `--surface-elevated` background, 1px `--border-subtle`, `--radius-overlay`, `--shadow-overlay` |
| `focus-ring` | 2px `--color-interactive-border` outline at 2px offset |

Context carries `--ink-secondary` text and the inspector carries `--ink-primary`:
the map is quieter than the lens, because the lens describes the thing being
worked on.

A recipe and its background token often share a name — the `surface-panel` recipe
is built on the `--surface-panel` token. That parallel is deliberate: the recipe
is the composition, the token is the one color inside it. Where they diverge, as
in `surface-context` and `surface-inspector`, it is because two regions share a
background and differ in ink and edge.

How these recipes are expressed in CSS is an implementation choice. They are
named here so the names stay stable however they are declared.

## Selection

`--surface-selection` is derived rather than authored, so it tracks the engaged
hue whatever the theme and whichever set is active:

```css
--surface-selection: color-mix(in srgb, var(--color-active-border) 22%, transparent);
```

It is used by `::selection` and held while an editor is blurred, so a selection
stays visible when focus moves to an inspector or drawer.

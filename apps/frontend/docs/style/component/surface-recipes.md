# Surface recipes

> **Compositions.** How surface tokens combine into the actual planes of the
> shell. The tokens themselves are enumerated in
> [Surfaces](../catalog/surfaces.md).

The shell should feel like a luminous instrument: calm central work, precise
panels, obvious boundaries. Depth here is **structural**, not decorative — it
tells a user which plane they are on, not that the designer owned a shadow tool.

## What each plane is for

| Plane | Character |
| --- | --- |
| Canvas | The atmospheric field the app sits in. Low contrast, recedes completely. |
| Work | The reading and editing plane. Maximum comfort, minimum interference. |
| Panel | Context, inspector, and cards. Slightly recessed; supports the center. |
| Elevated | Overlays, modals, popovers, drawers. The only plane that floats. |

The work surface is *brighter* than the panels around it in Celestial Light and
*separated* from them in Cyberpunk Night. In both themes the eye should land on
the center without being told to.

## Elevation levels

Four levels, each a fixed combination. A surface picks one; it does not invent a
fifth.

| Level | Composition |
| --- | --- |
| Flat | Background only. The canvas and the work surface. |
| Bounded | Background + 1px `--border-subtle`. Panels, inputs, table containers. |
| Raised | Background + border + `--shadow-panel`. Cards that must read as separable. |
| Floating | `--surface-elevated` + border + `--radius-overlay` + `--shadow-overlay`. Overlays and drawers. |

Two laws govern elevation:

- **Depth is earned by behaviour.** A surface floats only if it can be dismissed.
  If it cannot be closed, it is part of the layout and should be bounded.
- **Never a stack of cards.** Nesting raised surfaces inside raised surfaces
  destroys the plane hierarchy. One level of separation is almost always enough;
  two is the hard limit.

In Cyberpunk Night, elevation reads through **tonal separation plus a border**
rather than shadow, because shadow barely registers on a dark ground.

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
| `focus-ring` | 2px `--color-interactive-normal` outline at 2px offset |

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

## Scrolling

Document, context, inspector, and drawer regions **retain wheel, touch, and
keyboard scrolling while suppressing visible browser scrollbar chrome.** Their
bounded geometry and clipped content provide the affordance.

This is a genuine accessibility hazard and carries a hard condition: focused
content must always scroll into view, and no scrollable region may be reachable
only by dragging a bar that is not drawn. A region that cannot satisfy that shows
its scrollbar.

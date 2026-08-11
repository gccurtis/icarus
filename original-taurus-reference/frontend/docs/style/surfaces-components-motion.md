# Surfaces, components, and motion (authoritative)

> Status: **authoritative**. Values implemented in [`src/app.css`](../../src/app.css).
> Rationale: [reference baseline](../support/reference/style/surfaces-components-motion.md).

The shell should feel like a luminous instrument: calm central work, precise
panels, obvious controls, explicit state, motion that explains cause.

## Shell geometry

Exposed on the spacing scale, so every value works as `h-*`, `w-*`, `p-*`,
`gap-*`, etc.

| Element | Token | Utility (e.g.) | Value |
| --- | --- | --- | --- |
| Top bar | `--spacing-topbar` | `h-topbar` | 44px (2.75rem) |
| Tab strip | `--spacing-tabstrip` | `h-tabstrip` | 36px (2.25rem) |
| Context icon rail | `--spacing-rail` | `w-rail` | 44px (2.75rem) |
| Status surface | `--spacing-status` | `h-status` | 24px (1.5rem) |
| AI Agent (compact) | `--spacing-qb` | `h-qb` | 48px (3rem) |
| Context panel | `--spacing-context` | `w-context` | 280px (17.5rem) |
| Context panel min | `--spacing-context-min` | `min-w-context-min` | 220px (13.75rem) |
| Context panel max | `--spacing-context-max` | `max-w-context-max` | 380px (23.75rem) |
| Inspector | `--spacing-inspector` | `w-inspector` | 320px (20rem) |
| Inspector min | `--spacing-inspector-min` | `min-w-inspector-min` | 280px (17.5rem) |
| Inspector max | `--spacing-inspector-max` | `max-w-inspector-max` | 440px (27.5rem) |

Spacing rhythm: 4px base, 8px primary. Panels use 12–16px internal padding; the
center uses more air. Tailwind's default spacing scale is already 4px-based.

## Radii

Squared precision for grids and page seams; modest radii for controls and live
objects; larger radii only for elevated overlays.

| Token | Utility | Value | Use |
| --- | --- | --- | --- |
| `--radius-control` | `rounded-control` | 6px (0.375rem) | Buttons, inputs, chips |
| `--radius-panel` | `rounded-panel` | 10px (0.625rem) | Panels, cards |
| `--radius-overlay` | `rounded-overlay` | 16px (1rem) | Elevated overlays, modals |

## Surface utilities

Reusable structural zones. All are `@utility` classes and compose with variants
and token utilities (e.g. `surface-panel p-4`).

| Utility | Sets |
| --- | --- |
| `surface-work` | `bg-work` + primary text. The calm central work surface. |
| `surface-panel` | `bg-panel` + primary text + 1px subtle border. Generic bordered panel. |
| `surface-context` | `bg-panel` + secondary text + right subtle border. Map-like left rail. |
| `surface-inspector` | `bg-panel` + primary text + left subtle border. The right-hand lens. |
| `surface-elevated` | `bg-elevated` + border + `rounded-overlay` + `shadow-overlay`. Overlays. |
| `focus-ring` | 2px `focus` outline, 2px offset. Manual focus styling. |

Surface roles: the app background is a low-contrast atmospheric field; the work
surface maximizes reading comfort; context is slightly recessed and map-like; the
inspector is precise and slightly cooler; status stays infrastructural. Avoid
turning the interface into a stack of cards.

Document, context, and inspector regions retain wheel, touch, and keyboard
scrolling while suppressing visible browser scrollbar chrome. Their bounded
geometry and clipped continuation provide the scroll affordance; focused content
must still scroll into view.

## Component principles

- One primary action per region when possible.
- Inputs have visible boundaries; placeholder text never substitutes for a label.
- Dropdowns are keyboard-operable, predictable, reserved for named secondary
  groups.
- Permanent destinations and closeable resource tabs are visually distinct.
- Tables support clear hover, selection, sorting, filtering, and dense metadata.
- Prompt blocks carry a restrained live-object treatment; detail moves to the
  inspector.
- Agent changes have explicit attribution, review, acceptance, and reversion
  states.

## Motion

Motion clarifies spatial cause and state change; it is never spectacle. A calm
ease-out (`--ease-taurus` = `cubic-bezier(0.2, 0.8, 0.2, 1)`, utility
`ease-taurus`) pairs with four standard durations, each also available as a
convenience utility that applies the ease + duration together.

| Token | Utility | Duration | Use |
| --- | --- | --- | --- |
| `--motion-micro` | `dur-micro` | 100ms | Micro feedback (80–120ms) |
| `--motion-small` | `dur-small` | 150ms | Small transitions (120–180ms) |
| `--motion-panel` | `dur-panel` | 220ms | Panel changes (180–240ms) |
| `--motion-overlay` | `dur-overlay` | 260ms | Overlays (200–280ms) |

Panels move toward the edge from which they collapse; AI Agent expansion rises
from its bottom anchor. Prefer stable layout, calm ease-out, and subtle progress over
bounce or perpetual spinning. `prefers-reduced-motion: reduce` is honored
globally (animations/transitions collapse to ~0) while state stays explicit.

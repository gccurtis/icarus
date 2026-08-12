# Surfaces

> **Concrete tokens.** The planes, seams, corners, and depth of the interface.
> Color values here resolve to a [palette](palette.md) entry; geometry values are
> declared once and do not vary by theme.

Four token families describe every physical property of a surface: what color it
is, where it ends, how its corners are cut, and how far it sits off the plane
below. How they compose into an actual panel or overlay is
[Surface recipes](../component/surface-recipes.md).

## Surface colors

The planes content sits on. Each theme draws its surfaces from its own neutral
family — warm `white` for Celestial Light, cool `black` for Cyberpunk Night.

| Token | Role | Celestial Light | Cyberpunk Night |
| --- | --- | --- | --- |
| `--surface-canvas` | App background — atmospheric field | `white-light` `#F7F4EC` | `black-strong` `#05070A` |
| `--surface-work` | Work surface — maximum reading comfort | `white-muted` `#FFFEFA` | `black-emphasized` `#0B0F14` |
| `--surface-panel` | Panel, context, inspector base | `white-normal` `#EEEAE0` | `black-normal` `#111827` |
| `--surface-elevated` | Overlays, modals, drawers | `white-faded` `#FFFFFF` | `black-light` `#172033` |

Long-form work should feel like pearl paper or illuminated stone in Celestial
Light, and stay dimensional — never flat black — in Cyberpunk Night.

## Borders

| Token | Use | Celestial Light | Cyberpunk Night |
| --- | --- | --- | --- |
| `--border-subtle` | Panel seams, control boundaries, table rules | `white-strong` `#D8D3C4` | `black-muted` `#2A3445` |
| `--border-strong` | Emphasis, active boundaries, dense grid axes | `white-deep` `#B9B3A1` | `black-faded` `#42506A` |

Both borders come from the far end of the theme's own surface family — the seam
between two planes is the same material as the planes, pushed one or two steps.

## Radii

Squared precision for grids and page seams; modest radii for controls and live
objects; larger radii only for things that genuinely float. Soft, not bubbly.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-control` | 6px / 0.375rem | Buttons, inputs, chips, tags |
| `--radius-panel` | 10px / 0.625rem | Panels, cards, live-object blocks |
| `--radius-overlay` | 16px / 1rem | Modals, popovers, drawers, elevated overlays |

Structural seams — the boundary between context and work, a table rule, a tab
strip edge — are square. Rounding a structural seam makes the shell look like a
collection of widgets instead of one instrument.

## Shadows

| Token | Celestial Light | Cyberpunk Night |
| --- | --- | --- |
| `--shadow-panel` | `0 1px 2px rgb(29 35 41 / 0.06)` | `0 1px 2px rgb(0 0 0 / 0.4)` |
| `--shadow-overlay` | `0 12px 32px -8px rgb(29 35 41 / 0.18)` | `0 16px 40px -12px rgb(0 0 0 / 0.6)` |

Shadow is the one geometry family that varies by theme, because it is made of
color. In Cyberpunk Night it barely registers on a dark ground, which is why
elevation there is carried by tonal separation and a border instead — the tokens
still resolve, but they are a secondary signal.

## Selection

`--surface-selection` is derived rather than authored, so it tracks the engaged
hue in both themes:

```css
--surface-selection: color-mix(in srgb, var(--color-active-normal) 22%, transparent);
```

It is used by `::selection` and held while an editor is blurred, so a selection
stays visible when focus moves to an inspector or drawer.

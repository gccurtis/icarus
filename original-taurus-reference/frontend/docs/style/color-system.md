# Color system (authoritative)

> Status: **authoritative**. Every value here is implemented in
> [`src/app.css`](../../src/app.css). Rationale: [reference baseline](../support/reference/style/color-system.md).

Color is a cognitive map for action, state, authorship, liveness, and trust. It
expresses angelic luminosity and astro-tech precision — never generic
white-and-blue minimalism or saturated cyberpunk.

Colors are exposed as **semantic** tokens (named by meaning, not hue) that resolve
to the active theme. Each generates the full Tailwind family: `bg-*`, `text-*`,
`border-*`.

## Semantic roles

Roles carry meaning; the underlying hue shifts per theme for contrast. Light-theme
values are the Taurus brand hues; Eclipse lightens them so they stay legible on
dark surfaces.

| Role (token) | Utilities | Meaning | Celestial | Eclipse |
| --- | --- | --- | --- | --- |
| `--color-action` | `bg-action` `text-action` | Primary action / selected primary nav (Aether Blue) | `#3657C9` | `#6E8BFF` |
| `--color-action-fg` | `text-action-fg` | Foreground on action fills | `#FFFEFA` | `#05070A` |
| `--color-focus` | `text-focus` `bg-focus` | Focus, liveness, resolution, sync (Halo Cyan) | `#0087B8` | `#38BDF8` |
| `--color-intel` | `text-intel` | AI, prompts, memory, formulas, derived intelligence (Vesper Violet) | `#6F49D8` | `#A98BFF` |
| `--color-attention` | `text-attention` | Pending judgment, staleness, review (Aureate Amber) | `#8A5A13` | `#E0A93B` |
| `--color-success` | `text-success` | Applied, accepted, valid, safe | `#1E7A46` | `#3DD68C` |
| `--color-danger` | `text-danger` | Failed, rejected, destructive, denied | `#C0362C` | `#F2645A` |

> `success` (green) and `danger` (red) had no explicit hex in the reference
> baseline; the values above are our chosen, contrast-checked defaults.

## Surfaces

| Token | Utility | Role | Celestial | Eclipse |
| --- | --- | --- | --- | --- |
| `--color-canvas` | `bg-canvas` | App background (atmospheric field) | `#F7F4EC` | `#05070A` |
| `--color-work` | `bg-work` | Work surface (max reading comfort) | `#FFFEFA` | `#0B0F14` |
| `--color-panel` | `bg-panel` | Panel / context / inspector base | `#EEEAE0` | `#111827` |
| `--color-elevated` | `bg-elevated` | Elevated overlays | `#FFFFFF` | `#172033` |
| `--color-selection` | `bg-selection` | Text-selection wash — also held while the editor is blurred | `focus @ 22%` | `focus @ 22%` |

Long-form work should feel like pearl paper or illuminated stone in light, and
stay dimensional (never pure black) in dark. `--color-selection` is a derived wash
(`color-mix` of `--role-focus` at 22% alpha, defined once as `--surface-selection` per
theme) used by `::selection` and by the editor's blurred-selection hold decoration, so a
selection stays visible while the inspector has focus.

## Text

| Token | Utility | Celestial | Eclipse |
| --- | --- | --- | --- |
| `--color-primary` | `text-primary` | `#1D2329` | `#F7F4EC` |
| `--color-secondary` | `text-secondary` | `#3A424D` | `#D8D3C4` |
| `--color-muted` | `text-muted` | `#6C716C` | `#93A0B4` |

## Borders

| Token | Utility | Celestial | Eclipse |
| --- | --- | --- | --- |
| `--color-border` | `border-border` | `#D8D3C4` | `#2A3445` |
| `--color-border-strong` | `border-border-strong` | `#B9B3A1` | `#42506A` |

## Elevation

Elevation comes from border + a restrained shadow (light) or tonal separation +
border (dark), never a stack of cards.

| Token | Utility | Celestial | Eclipse |
| --- | --- | --- | --- |
| `--shadow-panel` | `shadow-panel` | `0 1px 2px rgb(29 35 41 / 0.06)` | `0 1px 2px rgb(0 0 0 / 0.4)` |
| `--shadow-overlay` | `shadow-overlay` | `0 12px 32px -8px rgb(29 35 41 / 0.18)` | `0 16px 40px -12px rgb(0 0 0 / 0.6)` |

## Usage laws

- Blue (`action`) is action, not decoration.
- Violet (`intel`) is intelligence, not ordinary navigation.
- Cyan (`focus`) is liveness and focus.
- Amber (`attention`) means human judgment is required.
- Red (`danger`) means failure, denial, or destruction — not mere absence.
- Green (`success`) means confirmed or safe — not generic positivity.
- Glow is allowed only when it carries state.
- Color never works alone; pair it with copy, icons, position, border, or shape.

## Theming mechanics

- Semantic color tokens are declared with `@theme inline`, so each utility emits
  a live `var(...)` reference and follows whichever theme is active.
- Concrete values live in theme layers: `:root, [data-theme='celestial']`
  (default) and `[data-theme='eclipse']`.
- Switch themes by setting `data-theme` on the root `<html>` element:
  `document.documentElement.dataset.theme = 'eclipse'`.
- The `dark:` variant is rebound to `[data-theme='eclipse']` (via
  `@custom-variant`), so it targets the explicit theme rather than the OS
  preference.
- Each theme also sets `color-scheme` (`light` / `dark`) so native controls and
  scrollbars match.

## Accessibility

Normal text meets at least 4.5:1 contrast; large text and meaningful non-text UI
meet at least 3:1. Focus uses a visible `#0087B8`/`#38BDF8` perimeter (2px,
2px offset) applied globally to interactive elements. Validate working token
pairings rather than assuming palette values are safe everywhere.

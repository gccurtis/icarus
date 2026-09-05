## Four stages, one direction

A colour on screen is the end of a chain of four declarations, each in its own file and its own namespace ([[check:stage-owns-its-namespace]]), each reading only the stage behind it ([[check:references-point-backward]]).

1. **A chromatic theme** writes the only literal colours in the repository ([[check:literal-colours-in-themes-only]]): thirteen ramps of seven steps as `--palette-<hue>-<step>`, and thirteen `--theme-*` tokens for the achromatic jobs — canvas, work, panel, elevated, borders, inks, a shadow tint. [[file:app/src/lib/styles/chromatic-themes/celestial/celestial.css]] is light and binds `:root`; [[file:app/src/lib/styles/chromatic-themes/cyberpunk/cyberpunk.css]] is dark and binds `[data-theme="cyberpunk"]`.
2. **The slot table**, [[file:app/src/lib/styles/chromatic-themes/slots.css]], folds every hue into slots — `surface`, `surface-hover`, `border`, `fill`, `fill-hover`, `text`, `on-fill` — as `--chromatic-<hue>-<slot>`, using `light-dark()` so one declaration reads the faded end of a ramp under a light theme and the deep end under a dark one.
3. **Semantic tokens** under `semantic-tokens/` are the public boundary: `--token-color-<role>-<slot>` binds a role (success, danger, attention, inactive, interactive, active, intelligence, primary, secondary, accent-1, accent-2) to a hue's slots; `--token-surface-*`, `--token-border-*`, `--token-ink-*` and `--token-shadow-*` alias the theme tokens; typography, spacing, shape and motion have no colour in them at all.
4. **Integrations** under `x-integrations/` show the tokens to Tailwind and shadcn without showing anything behind them ([[page:/design-system/integrations|explained]]).

A component names `--token-*` and nothing else ([[check:consumers-see-public-tokens-only]]). This wiki obeys the same rule: its stylesheet imports the theme files, the slot table and the five token domains, and every colour in it is a `--token-*` reference.

## How a colour reaches a component

Take the border of a focused control. The diagram below follows it from the celestial palette to a component's `outline`, with the live value of each step.

## Roles and hues

The role families come from [[file:app/scripts/lint/shared/styles.mjs]], which the linter and the extractor both read: four meaning roles pinned to their hues, three identity roles, four brand roles. [[check:themes-agree-with-each-other]] holds every role to all seven slots and holds the meaning hues fixed.

## The entry file

[[file:app/src/lib/styles/app.css]] imports Tailwind, the fonts, the default theme, the other theme, the slot table, the five token domains and the three integration sheets, in that order, and is itself imported once by [[file:app/src/routes/+layout.svelte]] ([[check:one-stylesheet-entry]]). The order below is read from the file.

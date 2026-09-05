## The public boundary

Everything a component may name, and nothing it may not. Five files under `semantic-tokens/`, one per domain, declare 127 tokens; [[check:consumers-see-public-tokens-only]] refuses a component that reaches behind them. A colour token is an alias to a chromatic slot or a theme token and holds no value of its own ([[check:literal-colours-in-themes-only]]); the other four domains hold plain values — rem, ms, an easing — because nothing about typography, spacing, shape or motion changes with a theme.

Each token below shows its declared value and, for colours, a swatch painted by the live variable. Search reaches every one by name.

## color

Eleven roles × seven slots, then the achromatic jobs: five surfaces and a selection, four inks, two borders, three shadows. Every value is a `var(--chromatic-…)` or a `var(--theme-…)`. The first swatch is the live variable under this wiki's current theme; the second and third are the value resolved through the declared chain under celestial and cyberpunk.

## typography

Two font stacks and ten sizes, each with a matching `-leading`. IBM Plex Sans and IBM Plex Mono, loaded by `app.css` from `@fontsource`.

## spacing

One token. Every gap, padding and width in a component is a multiple of `--token-spacing-unit`, which is what lets the slot widths in the surfaces be stated as `calc(var(--token-spacing-unit) * 11)`.

## shape

Three radii and three shadows. The shadows read the theme's `--theme-shadow-tint`, which is why they are in the shape domain and still follow a theme.

## motion

Four durations and one easing. A duration names what is moving — micro, small, panel, overlay — not a number.

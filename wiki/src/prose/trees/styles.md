## What it is

The cascade, as a contract. Twenty files: one entry, two chromatic themes, one slot table, five token domains, two integration adapters and seven documents. A colour is written once, in a theme, and named everywhere else ([[check:literal-colours-in-themes-only]]); each stage declares its own prefix and reads only the stage behind it ([[check:stage-owns-its-namespace]], [[check:references-point-backward]]); and a component sees only `--token-*` ([[check:consumers-see-public-tokens-only]]). The [[page:/design-system|design system]] pages walk the layers with live values. This wiki is itself styled through those files and nothing else.

## What it owns

- [[file:app/src/lib/styles/app.css]] — the single entry. The root layout imports it once and nothing else imports a stylesheet ([[check:one-stylesheet-entry]]); its imports are contiguous and in stage order, default theme first, slots after every theme.
- `chromatic-themes/` — [[file:app/src/lib/styles/chromatic-themes/celestial/celestial.css]] (light; binds `:root`) and [[file:app/src/lib/styles/chromatic-themes/cyberpunk/cyberpunk.css]] (dark), each declaring the same 13 palette ramps × 7 steps and the same 13 `--theme-*` tokens ([[check:themes-agree-with-each-other]]); and [[file:app/src/lib/styles/chromatic-themes/slots.css]], which folds every hue into `--chromatic-<hue>-<slot>` with `light-dark()`.
- `semantic-tokens/` — `color.css`, `typography.css`, `spacing.css`, `shape.css`, `motion.css`: the public boundary, 127 tokens.
- `x-integrations/` — `tailwind/tailwind.css` maps tokens into Tailwind's `@theme static`; `shadcn/bridge.css` and `variants.css` give the vendored parts their vocabulary; `shadcn/generated.css` is the CLI's output, quarantined and imported by nothing ([[check:generated-css-is-inert]]).

## What it may and may not import

Stylesheets import stylesheets, backwards only. A theme reads its own palette; slots read theme values; tokens read theme or chromatic values; an integration names public tokens and nothing behind them. Nothing in `src/` other than the root layout imports any of these files.

## Shape on disk

```
styles/
  app.css
  chromatic-themes/
    chromatic-themes.md
    slots.css
    celestial/{celestial.css, celestial.md}
    cyberpunk/{cyberpunk.css, cyberpunk.md}
  semantic-tokens/
    semantic-tokens.md
    color.css typography.css spacing.css shape.css motion.css
  x-integrations/
    x-integrations.md
    tailwind/{tailwind.css, tailwind.md}
    shadcn/{bridge.css, variants.css, generated.css, shadcn.md}
```

Only `app.css` and the three stage directories sit at the root; token domains stay files ([[check:styles-layout]]).

## Invariants

Eight checks under `scripts/lint/styles/`. `themes-agree-with-each-other` alone has four subjects — same token set, registration matches `app.html`, every colour role declares all seven slots, meaning hues pinned — and is the reason a new theme cannot leave a value resolving to nothing.

## What to open first

1. [[file:app/src/lib/styles/app.css]] — the order is the architecture.
2. [[file:app/src/lib/styles/chromatic-themes/chromatic-themes.md]], then a theme file; the ramps are the only literal colours in the repository.
3. [[file:app/src/lib/styles/chromatic-themes/slots.css]] — how light and dark become one declaration.
4. [[file:app/src/lib/styles/semantic-tokens/color.css]] — the roles: success, danger, attention, inactive, interactive, active, intelligence, primary, secondary, accent-1, accent-2.
5. [[file:app/src/lib/styles/x-integrations/tailwind/tailwind.css]] — why a Tailwind class like `bg-surface-panel` resolves to a token.

The two theme documents link to `docs/design-preferences.md`, which is not in the repository. Recorded under [[page:/gaps|Gaps]].

## Units

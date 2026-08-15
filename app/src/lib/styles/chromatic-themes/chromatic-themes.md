# Chromatic Themes

A theme declares literal palette ramps, `color-scheme`, and private neutral
material. Every theme implements the same custom-property interface. It changes
values, never names or semantic meanings.

`slots.css` converts each palette ramp into the seven private chromatic jobs:
`surface`, `surface-hover`, `border`, `fill`, `fill-hover`, `text`, and
`on-fill`. Later stages use `--chromatic-*` and never select intensity steps.

<!-- generated:theme-inventory:start -->
| Theme | Scheme | Default |
| --- | --- | --- |
| `celestial` | light | yes |
| `cyberpunk` | dark | no |
<!-- generated:theme-inventory:end -->

New themes are created with `pnpm new-style-theme` and remain drafts until
their palette, theory, contrast, and rendered combinations are reviewed.

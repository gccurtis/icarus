## What a theme declares

A theme is one CSS file under `chromatic-themes/<name>/` that declares exactly what every other theme declares ([[check:themes-agree-with-each-other]]): 13 palette ramps × 7 steps — `faded`, `light`, `muted`, `normal`, `emphasized`, `strong`, `deep` — and 13 `--theme-*` tokens, plus one `color-scheme` that tells every `light-dark()` in the slot table which end to read. The theme names no jobs: nothing in it says what a hue is *for*. That is the slot table's and the tokens' business. Everything below is read from the two files; the swatches are painted by the live variables, so switching this wiki's theme repaints them.

`pnpm new-theme` writes a third theme declaring the same set, and the check refuses one that does not.

## celestial

Light. Binds `:root` as well as `[data-theme="celestial"]`, so it is what a page shows before any theme is chosen — [[file:app/src/app.html]] hard-codes the attribute to match, and `themes-agree-with-each-other` checks that it does.

## cyberpunk

Dark. Binds `[data-theme="cyberpunk"]` and declares `color-scheme: dark`, which is the only thing that flips every slot to the deep end of its ramp. There is no separate dark switch; [[file:app/src/lib/surfaces/top-bar/effects/apply-theme.svelte.ts]] writes `data-theme` on `<html>` and one localStorage key.

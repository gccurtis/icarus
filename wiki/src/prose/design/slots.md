## What a slot is

A ramp is seven values with no meaning; a slot is a job a hue can do — be a surface, a border, a fill, text — with the right step chosen for each scheme. [[file:app/src/lib/styles/chromatic-themes/slots.css]] declares `--chromatic-<hue>-<slot>` for every hue, and where light and dark differ it says both in one line: `light-dark(var(--palette-red-faded), var(--palette-red-deep))`. The theme's `color-scheme` picks the branch, which is why a theme can be a single file of values and still be light or dark.

The slot names come from [[file:app/scripts/lint/shared/styles.mjs]], where `SLOTS` lists what every colour role must declare. The table below is every declaration in the file with its live value under the current theme.

## The table

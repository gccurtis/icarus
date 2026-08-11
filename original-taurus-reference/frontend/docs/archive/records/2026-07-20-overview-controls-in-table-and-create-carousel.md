# Change record — 2026-07-20 — Overview: in-table controls + create carousel

Re-lays out the Overview stage: filter/sort/search move **inside the table header**,
the create cards become a **single centered carousel surface**, the "Create" heading is
dropped, and the top/bottom spacing is retuned so nothing crowds the title or the
Quarterback dock.

## Popover: fixed-coordinate positioning

```svelte
style={panelStyle}  <!-- position: fixed; computed from the trigger rect -->
```

**Why:** the filter/sort popovers now live inside the table frame, which is
`overflow-hidden` (to clip its rounded corners) — an absolutely-positioned panel would
be clipped. **How:** `Popover` now reads the trigger's `getBoundingClientRect()` on open
and renders its panel with `position: fixed` (honoring `bottom` / `top` / `bottom-end`
placement), so it escapes any clipping/scrolling ancestor — mirroring the `Menu` fix.

## Filter / sort / search inside the table header

```svelte
<div class="flex … overflow-hidden rounded-panel border border-border">
  <div class="flex … border-b … px-3 py-2"> …Filter, Sort, Search… </div>
  …column header… …scrolling rows…
</div>
```

**Why:** the controls belong to the table, and pulling them into its header frees the
row above it. **How:** the table frame's first row is a controls header holding the two
popovers plus the search box; the "Resources" heading now sits directly above the
frame.

## Create carousel (one shared surface)

```svelte
<section class="mt-5 flex justify-center">
  <div class="create-strip surface-panel flex max-w-full gap-1 overflow-x-auto rounded-panel p-1">
    …segment per type: icon tile + "New <type>"…
```

**Why:** the wide, spread-out cards wasted horizontal space; one compact centered strip
reads better. **How:** the "Create" heading is gone; a single `surface-panel` centered
under the title holds a segment per type (small colored icon tile + "New document /
spreadsheet / slides / chat / board"), each transparent until `hover:bg-elevated`. The
strip is `max-w-full overflow-x-auto` (scrollbar hidden via a scoped `<style>`), so it
behaves like a small carousel when the segments don't all fit.

## Spacing

**Why:** too much air under the title, and the table looked like it sat on the dock.
**How:** the title→create gap tightens to `mt-5`, and the stage's bottom reserve grows
to `pb-20` so the table frame ends with clear air above the (unchanged, `bottom-4`)
Quarterback dock.

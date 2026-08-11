# Change record — 2026-07-20 — Panel border, cyclical templates carousel, New-tab reorder

## New resource panel: a border

```svelte
<div class="flex w-full items-stretch gap-1 rounded-panel border border-border p-1.5">
```

**Why:** with no background the panel didn't read as a distinct section, but a background
made the AI button's purple feel blended. **How:** keep it **background-free** but add a
**border** — a distinct section without a fill that clashes with the buttons.

## Templates carousel: extracted, cyclical, faded edges

```svelte
const loop = $derived([...templates, ...templates, ...templates]);  // 3 copies
function onScroll() { /* jump ±one copy when leaving the middle → seamless loop */ }
```

**Why:** the templates strip should scroll **cyclically** (infinite, in circles), the
cut-off cards should look **faded** not hard-cut, and there should always be a margin.
**How:** pulled the strip into a new
[`TemplatesCarousel`](../../../src/lib/features/stages/TemplatesCarousel.svelte):
- **Cyclical scroll** — renders the templates 3× and, on scroll, jumps back/forward by
  exactly one copy width whenever you leave the middle copy (invisible since copies are
  identical), so it loops forever in both directions. A wheel handler translates vertical
  wheel to horizontal (like the tab strip).
- **Faded edges** — a horizontal `mask-image` gradient fades both edges, so cut-off cards
  fade into an always-visible margin instead of a hard cut.
- Cards keep their own `surface-panel` background and lift on hover.

## New tab: reorder + slimmer header

```svelte
<header><p …>New tab</p></header>   <!-- dropped the big "Start something" title -->
<NewResourcePanel … />              <!-- now ABOVE templates -->
<TemplatesCarousel … />
<ResourceTable … />
```

**Why:** the bold "Start something" felt like too much, and the panel reads better above
the templates. **How:** dropped the `<h1>` (kept the "New tab" eyebrow) and reordered to
**panel → templates → table**.

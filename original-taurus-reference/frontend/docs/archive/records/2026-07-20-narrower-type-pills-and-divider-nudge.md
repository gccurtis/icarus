# Change record — 2026-07-20 — Narrower type pills + panel divider nudge

Two small tweaks.

## Narrower Type column

```svelte
const gridCols =
  'grid-cols-[1.75rem_minmax(0,1fr)_5rem_4.25rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_5rem_6.5rem_4.25rem]';
```

**Why:** with "Spreadsheet" gone, the widest type label is now "Document", so the Type
pills don't need the old width. **How:** the Type column shrinks `6.5rem` → `5rem` (the
badges are `w-full`, so they narrow with it).

## New resource panel divider nudge

```svelte
<div class="ml-2 mr-1 w-px shrink-0 self-stretch bg-border"></div>   <!-- was mx-1 -->
```

**Why:** the divider read as hugging "AI create" (the first create's content is centered
in its wide `flex-1` cell, so it sits visually farther from the divider). **How:** nudged
the divider right (`ml-2 mr-1`) so it looks centered between AI create and New document.

# Change record — 2026-07-20 — Overview stage: internal scroll + popover filter/sort

Refines the Overview stage per feedback: the **stage frame no longer scrolls** (only
the table body does), the create cards are compacted (icon over label, no "New"), and
the table's filter/sort move into **popovers** so they never overflow the toolbar.

## Menu: fixed-coordinate positioning

```svelte
<!-- Menu dropdown now positions with viewport-fixed coords from the trigger rect. -->
style="position: fixed; top: {pos.top}px; {align === 'end' ? `right: ${pos.right}` : `left: ${pos.left}`}px;"
```

**Why:** once the table body scrolls (`overflow-y-auto`), an absolutely-positioned row
menu would be clipped by the scroll container (the same clipping we hit with the
projects list). **How:** on open, `Menu` reads the trigger's `getBoundingClientRect()`
and renders the dropdown with `position: fixed`, so it escapes any
overflow-clipping/scrolling ancestor. General fix — benefits every `Menu`.

## WorkSurface: the stage owns its scrolling

```svelte
<main class="min-w-0 flex-1 overflow-hidden bg-work">
```

**Why:** the user wants the stage frame not to scroll — the table inside should. **How:**
`main` becomes `overflow-hidden`; the Overview stage manages its own internal scroll,
and the placeholder stages (Agents / resource tabs) wrap their content in an `h-full
overflow-auto` region so they still scroll when tall.

## OverviewStage: full-height column + compact cards

```svelte
<div class="mx-auto flex h-full max-w-4xl flex-col px-8 py-8">
  ...
  <h2 class="mb-3 text-h4 font-semibold">Create</h2>
  <!-- card: flex-col, icon over label, no "New" prefix -->
```

**Why:** the Create header should match the Resources header, the cards were too big
and verbose, and the stage must not scroll. **How:** the stage is an `h-full` flex
column (header + create are `shrink-0`; the Resources section is `min-h-0 flex-1` so
the table fills the rest). The **Create** header is now `text-h4` (same as Resources);
each card is a smaller `flex-col` tile with the icon over the plain type name (the
section header already says "Create", so the "New" prefix is dropped).

## ResourceTable: popover filter/sort + scrolling body

```svelte
<!-- Filter/Sort live in <Popover>s; the table frame scrolls only its row body. -->
<Popover label="Filter"> …conditions stacked vertically… </Popover>
<Popover label="Sort"> …field + direction… </Popover>
```

**Why:** inline filter chips overflowed the toolbar once more than one was added; the
system needed to stay simple and non-distracting as filters grow. **How:** filter
conditions now live **stacked vertically inside a Filter popover** (the trigger tints +
shows a count badge), and sorting lives in a small **Sort popover** (field + asc/desc,
with column headers still clickable). The table is a flex column with a `shrink-0`
header and a `min-h-0 flex-1 overflow-y-auto` body — so only the rows scroll. Filter
fields stay **Type** and **Name**; sort covers **Name / Type / Updated** (a natural
seam for a later last-edited sort). Conditions still AND together.

# Change record — 2026-07-20 — Overview: AND/OR filters + card & dock spacing

Follow-up refinements: an AND/OR combinator for the table filters, background-free
compact create cards, tighter top spacing, and a lowered Quarterback dock that no
longer overlaps the table.

## Filter combinator (AND / OR)

```svelte
{#if conds.length >= 2}
  <span>Match</span>
  <select value={match} onchange={…}><option value="all">all</option><option value="any">any</option></select>
  <span>of the filters</span>
{/if}
```

**Why:** conditions were always ANDed; the user wants to choose. **How:** a `match`
state (`all` = AND / `any` = OR) drives the derived rows via `every`/`some` over the
**active** conditions (blank Name filters are ignored so they can't swallow an OR). A
compact **Match all / any** selector appears at the top of the filter popover once
there are two or more conditions.

## Background-free, compact create cards

```svelte
<button class="dur-small flex flex-col items-center gap-1.5 rounded-panel px-3 py-2 text-center transition-colors hover:bg-panel">
```

**Why:** the cards read better without a filled background and take less vertical room.
**How:** dropped `surface-panel` (cards are now transparent with a slight `hover:bg-panel`),
tightened padding/gap (`py-2`, `gap-1.5`) and shrank the icon tile (`size-8`), which
pulls the whole stage up.

## Tighter top spacing

```svelte
<div class="mx-auto flex h-full max-w-4xl flex-col px-8 pt-6 pb-16">
  <section class="mt-6 …">Create</section>
  <section class="mt-6 …">Resources</section>
```

**Why:** move everything closer to the title and reclaim space. **How:** section gaps
go `mt-8` → `mt-6`, header margins tighten, and the stage's top padding is `pt-6`.

## Quarterback dock no longer overlaps the table

```svelte
<div class="… absolute bottom-4 …">   <!-- was bottom-6 -->
```

**Why:** the floating dock sat on top of the table. **How:** the dock drops to
`bottom-4`, and the Overview stage reserves matching bottom room with `pb-16`, so the
table frame ends above the dock instead of running underneath it.

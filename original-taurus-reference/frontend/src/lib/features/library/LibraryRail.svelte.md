# `LibraryRail.svelte` — the library map

The left rail: which owner's library you are looking at, a search box, and the assets themselves.
One component serves both spaces; only the icon and the list differ.

## Names, and nothing else

```svelte
<Layers class="size-3.5 shrink-0 text-muted" />
<span class="flex-1 truncate text-body-sm text-primary">{c.name}</span>
{#if isOrg(c.ownerId)}<Building2 class="size-3 shrink-0 text-muted" />{/if}
```

Rows carry a kind icon, the name, and an organization marker. An earlier pass put
`6 resources · 2 days ago` under each name; it looked like data but answered no question a
browsing user actually has, and it forced the two lists into different shapes for no reason.
Counts and dates live in the detail panel, where they are read deliberately rather than scanned
past.

## Filtering is the console's job, not the rail's

`contexts` and `templates` arrive already filtered; `query` and `owner` are `$bindable`, so the
rail owns the controls while `LibraryConsole` owns the derivation. That keeps the rail a view and
avoids two components each holding half of one filter.

## Quiet scrolling

The list drops visible scrollbar chrome while keeping wheel, touch, and keyboard scrolling — the
convention `SidePanel` and `TabStrip` already follow locally, and what the style spec asks for.
Bounded geometry and clipped continuation are the affordance.

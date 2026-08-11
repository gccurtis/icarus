# `ActivityList.svelte`

A capped, scrollable list of activity events whose rows **expand in place** to show what that edit
changed. Used by both Overview lenses, which is the point: the resource lens's "Recent activity" and
the activity lens's "Other activity on this document" are the same thing and must behave the same.

## Expanding, not navigating

Clicking a row reveals its change inline. An earlier version made these rows *select* that event,
swapping the whole lens — which was wrong twice over: it threw away the panel you were reading, and
it implied the list was a navigation surface when the events it can reach are only the ones already
loaded. Expansion keeps the answer next to the question.

```svelte
<button onclick={() => toggle(ev)} aria-expanded={open}>
```

Only one row is open at a time (`openId`), so the panel cannot grow without bound as you explore.

## One history read for the whole list

```ts
const loaded = entries ?? (await fetchDocumentHistory(documentId, HISTORY_DEPTH)).entries;
entries = loaded;
```

History is fetched on the **first** expansion and cached in component state. Fetching per row would
re-read the same 50 entries every time; fetching on mount would pay for a panel the user may never
expand. After that, each expansion costs only its own detail lookup (plus the bounded prior-text
walk in `change-detail.ts`).

`changes` memoises per event id, so collapsing and re-opening a row is free. A `$effect` on
`documentId` clears `openId`, `changes`, and `entries` together — a cached change from the
previously inspected resource must never be shown under a new one.

## `documentId` is the expandability switch

Change-level detail exists only for documents, so the prop is null for every other kind and the rows
render as plain text. A chevron that always answered "no stored change matches this event" would be
worse than no chevron.

## The container

```svelte
<div class="max-h-56 overflow-y-auto rounded-control border border-border">
```

Height-capped so a busy document clips instead of pushing the rest of the lens off the panel, and
**bordered** so the clipping reads as deliberate rather than as content that ran out. The scrollbar
is left native rather than hidden the way the main feed hides its own: inside a short nested
section, an invisible scrollbar makes the remaining content undiscoverable.

# `activity-filter.ts`

What "filter this activity list" means: the model, the predicate, and the one case Omega can answer
itself. Pure, shared by the context rail's History lens and the Overview stage's Activity box, and
covered by `activity-filter.test.ts`.

## Why a predicate and not a query

Omega's `/activity` accepts `limit`, `cursor`, and `targetID` — **there is no actor or kind
parameter**. Every event does carry `actor.id` and `target.kind` in its payload, so filtering by
person or type is a client-side predicate over the pages that have been loaded, plus paging.

That is honest as long as the surface says so, which is why both callers render a scope line ("3 of
50 searched") rather than a bare match count: "3 matches" alone would imply the whole history had
been searched. It also needs nothing from the backend, and it is complete in the limit — keep paging
and you eventually search everything.

## The model

```ts
export type ActivityFilter = {
  actorIds: string[];
  resourceIds: string[];
  kinds: ResourceKind[];
};
```

Three dimensions, all multi-valued, so the dialog can grow to multi-person selection without a type
change. `EMPTY_FILTER` is the inactive value and `isFilterActive` is the one check callers use — no
surface should be testing three array lengths itself.

## The semantics that had to be chosen

```ts
if (filter.actorIds.length && !filter.actorIds.includes(event.actor.id)) return false;
const targetNamed = filter.resourceIds.length > 0 || filter.kinds.length > 0;
if (!targetNamed) return true;
return filter.resourceIds.includes(event.target.id) || filter.kinds.includes(event.target.kind);
```

Dimensions AND, values within a dimension OR — with one deliberate exception: **`resourceIds` and
`kinds` OR with each other**, because both answer the same question ("which resource"). Ticking "Q3
brief" and also "all slides" means *that document or any deck*, which is how the picker's per-kind
"All" reads. ANDing them would match nothing, since no resource is simultaneously one named document
and a deck. A test names that case as the one that decides the design.

## The server path

```ts
export function serverTargetId(filter: ActivityFilter): string | undefined {
  return filter.resourceIds.length === 1 && filter.kinds.length === 0 ? filter.resourceIds[0] : undefined;
}
```

A filter naming exactly one resource is *exact and cheap* through `/activity?targetID=`: no
over-fetching, and paging counts only that resource's events. Any other shape has to be the
predicate, because `targetID` takes a single id. An actor filter rides along on top of the narrowed
stream, which is why it does not disqualify the fast path.

Only the History lens takes this path. The stage feed caps at `FEED_EVENT_CAP` and pages by scroll,
so re-fetching would buy it nothing the predicate does not already give.

## Chips

```ts
export function filterChips(filter, names): FilterChip[]
```

The active filter as removable chips, each carrying a `clear` that removes **only itself** — so the
caller's remove handler is `applyFilter(chip.clear(filter))` and no surface hand-rolls array
surgery. Name resolution is injected because the caller owns the roster and the catalog; anything
unresolvable falls back to a word ("Someone", "A resource") rather than an id, since an id on screen
tells the user nothing about what they filtered by.

Kind chips read "All documents" — **plural**, from `kindPluralLabel`. Built from `kindMeta.label`
(singular, because it labels one resource) the chip read "All document", which is what sent the
plural label into `features/shared/kinds.ts`.

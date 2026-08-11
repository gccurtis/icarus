# resource-groups.ts

The pure projection behind the context rail's **All resources** lens: the catalog as collapsible
groups, filtered by the lens's search field. It lives beside the panel rather than inside it so the
two rules that are easy to get subtly wrong can be asserted directly in `resource-groups.test.ts`.

## What a group is

```ts
export type ResourceGroup = {
  id: string;      // 'pinned' or a ResourceKind — stable, so collapse state can key on it
  label: string;
  items: Resource[]; // the rows to draw: everything, or just the matches
  total: number;     // how many the group holds IGNORING the search
};
```

`items` and `total` diverging is the whole point of the type. While a search is active the group
header reads "2 of 4", so the projection has to carry both numbers; a component that only received
the filtered array could not tell the user what it was filtering *out of*.

## Rule one — Pinned duplicates, it does not relocate

```ts
const pinned = list.filter((r) => r.pinned);
…
for (const kind of RESOURCE_KINDS) {
  const all = list.filter((r) => r.kind === kind.id);
```

A pinned document appears in **both** `Pinned` and `Documents`. The alternative — moving it out of
its kind group — has two bad consequences: `Documents (4)` would stop meaning "this project has four
documents", and pinning something would make it *harder* to find in the place you would look for it.
A shortcut that also removes the original is not a shortcut. `matchSummary` therefore counts from the
catalog rather than by summing groups, or a pinned match would be counted twice.

Kinds keep `RESOURCE_KINDS` order (documents, sheets, slides, chats, general) so the rail agrees with
every other kind list in the app, and a kind the project has none of is omitted rather than rendered
as an empty group.

## Rule two — a query prunes groups, but not the counts

```ts
return q ? groups.filter((g) => g.items.length > 0) : groups;
```

With a query, a group whose items all filtered out disappears entirely — an expanded-but-empty group
is noise. Without one, every non-empty group stays, so the rail's shape is stable when the field is
cleared. `total` is untouched by the query in both cases.

## Matching

```ts
function matches(resource: Resource, query: string): boolean {
  return !query || resource.name.toLowerCase().includes(query);
}
```

Name substring, case-insensitive, whitespace-trimmed by the caller. This is a **complete** search
rather than a partial one, and that is a fact about the catalog: `enterProjectResources` pages
`/resources` to exhaustion, so `$resources` is every resource this user is allowed to see. Searching
*inside* documents is deliberately not offered here — Omega has no content-search route (its
knowledge-lattice search is an agent tool, not an HTTP endpoint), and a field that searched only
titles while looking like it searched everything would be a lie.

Sorting is `byRecency` — most recently touched first, name as the tiebreak so the order is
deterministic for tests and for the eye.

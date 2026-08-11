# `activity-access.ts`

What an activity feed is allowed to **show** — the access rule shared by every surface that renders
activity, plus the two helpers that make it usable. `activity-access.test.ts` covers all three.

> **Moved here 2026-07-29** from `stages/overview/lens-helpers.ts`, unchanged. The context rail's
> History lens needed the same rule, the rail is *shell*, and the shell must not import from a stage
> (AGENTS.md → ownership-is-the-tree). Duplicating a disclosure rule was not an option, and a
> re-export left behind in the stage would have been the facade disease the L1–L3 cleanup removed —
> so Overview's own consumers now import it from here too.

## The redaction rule

```ts
export function isTargetRedacted(
  event: ActivityEvent,
  visibleIds: Set<string>,
  deletedIds: Set<string>
): boolean {
  if (visibleIds.has(event.target.id)) return false;
  return !deletedIds.has(event.target.id);
}
```

This closes a real disclosure. Omega filters `GET /resources` by access scope, so the catalog is
exactly the set of resources a user is allowed to know exists — but `GET /activity` performs **no**
access check and ships every event's target id, name, and kind. A member who cannot open a
restricted document is nonetheless told its name by the feed.

So the catalog is treated as the authority, and the rule **fails closed**: anything not positively
known to be visible or deleted is redacted. That default matters more than it looks — an empty
`visibleIds` (the catalog is still loading, or its request failed) must never read as "everything is
fine". Both callers additionally hold off until `resourcesLoaded`, because redacting the whole feed
for a moment is its own kind of wrong.

The real fix belongs to Omega:
[`docs/backend-requests/resource-access-enforcement.md`](../../../../docs/backend-requests/resource-access-enforcement.md).
This is a screen-level patch — the name is already in the browser by the time we hide it.

## Telling "restricted" apart from "deleted"

```ts
export function deletedTargetIds(events: ActivityEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) if (event.action === 'deleted') ids.add(event.target.id);
  return ids;
}
```

A deleted resource is also absent from the catalog, so without this every `created`/`edited` event
for a since-deleted resource would redact — even though the user watched it happen and its `deleted`
event names it two rows above.

The reason this works with no extra request is **ordering**: the feed is newest-first, so a
resource's deletion always loads before the older events naming it. By the time the client renders an
old `created` row, the `deleted` row is already in `events`. Reversing the feed's sort order would
silently break this.

The History lens inherits the property, since it pages the same newest-first feed — but note the
consequence of paging: a deletion that has not been *loaded yet* cannot exempt its older events, so
a target may read as `Redacted` until the page carrying its deletion arrives. Failing closed in that
window is the correct trade.

## The label

```ts
export const REDACTED_LABEL = 'Redacted';
```

One word, and a test asserts it stays one word: it appears where a resource name would, in rails
around 220px wide, and a sentence there would wrap into the row below it.

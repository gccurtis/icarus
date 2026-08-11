# Target-filtered activity feed

`GET /activity` can now be scoped to a single resource, so the document context
panel can show just that document's events (its edits plus resource create/rename
attributed to it) instead of the whole project feed.

## Change

- **`GET /activity?targetID=<resourceID>`** — an optional query parameter. Empty
  (or absent) keeps the existing project-wide behavior; a value restricts the
  feed to events whose `target.id` matches, still paginated by `cursor`/`limit`
  in the same newest-first order.
- The events already recorded their target (`ActivityFact.TargetID` → the
  `target_id` column), so this is a pure read filter — no new data.

## Where

- `activity.PageRequest` gains `TargetID`; the `activity.Store.ListActivity`
  signature gains a `targetID` argument (empty = no filter). The sqlite store
  adds `AND target_id = ?` to its query; the memory store filters in-loop. The
  handler reads `req.Query("targetID")`.

## Tests

- Unit (`core/capability/activity`): a target filter returns only that resource's
  events; an empty target returns the full project feed.
- Dev-test (`dev-test/resources`): after renaming a document resource,
  `GET /activity?targetID=<id>` returns its events with no foreign targets, and
  an unknown target returns an empty feed.

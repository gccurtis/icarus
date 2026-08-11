# Change record — 2026-07-21 — One tab per resource

Per direction: the front end tracks which resources are open; an editor is linked to
its resource; **a resource is only ever open in one tab**. One change in
[`data/workspace.ts`](../../../src/lib/data/workspace.ts) (+ companion), used by every
open path (resource table, overview, activity feed, the resources panel, the launcher).

## Behavior

- **`openTab(title)`** — opening a resource that's already open **re-routes** to its
  existing tab (activates it) instead of creating a duplicate.
- **`resolveTab(id, title)`** — a new-tab launcher resolving into an already-open
  resource **closes the launcher tab** and activates the existing one.
- A small `resourceTab(ws, title)` helper is the single lookup.

Matching is by title while resources are the name-keyed mock layer; when real resource
ids land ([backend-requests/resources.md](../backend-requests/resources.md)), tabs
carry ids and the lookup switches to them — same rule, stronger key.

## Verification

Covered by the increment-2 gate below (`pnpm check` 0/0, build clean).

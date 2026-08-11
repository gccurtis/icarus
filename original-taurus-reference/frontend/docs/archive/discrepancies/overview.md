# Discrepancy — Overview's purpose and activity are real (shape notes)

The Overview stage (the project's home) once carried two client-only mocks: an
editable **purpose statement** under the project name and an **activity feed** of
who did what, when. Both are now backed by real Taurus Omega APIs. What remains
here are the deliberate **shape translations** the front-end makes at the data
boundary.

## Purpose statement — real, role-gated

A short, editable project purpose carried by the real `Project.purpose` field in
[`data/projects.ts`](../../src/lib/data/projects.ts).
[`PurposeStatement.svelte`](../../src/lib/features/stages/overview/PurposeStatement.svelte)
derives its value from that shared project store and saves through
`PATCH /projects/:id`. Owners and editors can write; viewers see the persisted
value read-only. No `localStorage` stand-in exists.

## Activity feed — real, snapshot + on-demand resolution

[`systems/projects/activity.ts`](../../src/lib/systems/projects/activity.ts) loads a
bounded opaque-cursor page from `GET /activity`;
[`ActivityFeed.svelte`](../../src/lib/features/stages/overview/ActivityFeed.svelte)
renders historical **actor and target snapshots** without an N+1 request per row.
Those snapshots are immutable by design: a departed member or a deleted resource
keeps its stored row rather than producing a broken one. The feed resolves
*current* safe metadata only on interaction — a peer profile via
`GET /users/:userID` on actor hover (through the shared
[`IdentityHoverCard.svelte`](../../src/lib/components/IdentityHoverCard.svelte) and
`resolveFromUserId`), and target metadata via
`GET /resources/:kind/:resourceID` before opening a live
target (a 404 falls back to the snapshot). Timestamps arrive as ISO strings and
are parsed to epoch millis at the boundary.

The resource **table** on the same stage is now backed by Omega's real resource catalog
too (see [resources.md](resources.md)) — documents are fully wired; other kinds are
gated until Omega adds their adapters.

## Status

Both surfaces are shipped; no mock remains in the Overview stage's purpose or
activity. Their backend requests are recorded (now **Shipped**) in
[backend-requests/project-purpose.md](../archive/backend-requests/project-purpose.md) and
[backend-requests/activity-feed.md](../archive/backend-requests/activity-feed.md). The
resource table is now real too (documents) — its remaining gaps (non-document kinds,
import, content export) are tracked in
[resources.md](resources.md) and
[backend-requests/resources.md](../archive/backend-requests/resources.md).

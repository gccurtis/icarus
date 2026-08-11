# `overview-session.ts`

The Overview stage's inspector session — the same role `editor/session.ts` plays for the document
stage, and it exists for the same structural reason: the shell renders a surface's contributed
panels **with no props** (`{@render content?.(activeSection)}`), so a lens has to read its selection
from a store its stage writes.

## Two selections, deliberately separate

```ts
export type OverviewSelection =
  | { mode: 'none' }
  | { mode: 'resource'; resourceId: string }
  | { mode: 'resources'; resourceIds: string[] }
  | { mode: 'activity'; event: ActivityEvent; redacted: boolean };
```

Overview has two things a user can point at and they stay distinct: clicking a row is
**inspection**, ticking a checkbox builds the **bulk set** for download/export. Merging them would
mean that glancing at a resource silently arms a bulk action, so each gets its own lens instead and
whichever the user touched last is what the inspector shows.

`resource` and `resources` hold **ids**, not snapshots, so the lens reads the live catalog row — a
rename made elsewhere shows up while the lens is open, and a resource deleted underneath the
selection degrades to an honest message instead of stale facts. The activity mode carries the whole
event because it is immutable and has no other source; `redacted` is decided by `ActivityFeed`,
which owns the access rule, so the lens never re-derives it.

## `reveal()`

```ts
function reveal() {
  setPanel('inspector', { section: 'details', collapsed: false });
}
```

Every selecting action calls this. Selecting something is an explicit "show me this", so it is worth
overriding a collapsed rail or a different active section — the failure being avoided is a click
that appears to do nothing because the inspector happens to be closed. It lives in the store rather
than in the stage so it cannot be forgotten by one of the two call sites.

`inspectResources([])` is a clearing rather than a selection, and only clears when the current mode
is `resources` — unticking the last checkbox must not wipe a resource or activity selection the user
made afterwards.

## `overviewProjectId`

Panels get no props, so the per-resource timeline (`/activity?targetID=`) has no other way to learn
which project it belongs to. `OverviewStage` writes it alongside the surface contribution, and
clears the selection on project change — selections never cross projects.

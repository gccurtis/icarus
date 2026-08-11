# Activity reference resolution

This paired Taurus Alpha/Omega increment replaces Overview's generated Activity mock
with the real semantic feed while retaining historical events after a user or resource
has changed.

## `src/lib/data/overview.ts`

### Map the semantic Activity contract at the client boundary

The data layer loads opaque cursor pages from `GET /activity`, preserves the event's
actor/target snapshots for immediate rendering, and offers narrow current-state lookups
for a safe user profile and canonical resource metadata. This prevents N+1 requests on
feed load while keeping interaction current when possible.

## `src/lib/features/stages/overview/ActivityFeed.svelte`

### Render a real paged feed with state-safe loading

The component owns first-page and next-page async state, including empty/error states
and a generation guard that ignores a late response from the project just left. It drops
the mock badge, displays deleted targets as historical text, and passes live targets to
the parent only when they may be opened.

## `src/lib/features/stages/overview/ActivityActor.svelte`

### Resolve people lazily with snapshot fallback

Hovering or focusing an actor resolves its safe current display name once. A failed
lookup deliberately keeps the event snapshot, because Activity can outlive membership.

## `src/lib/features/stages/overview/OverviewStage.svelte`

### Resolve targets before opening tabs

The stage asks Omega for current canonical metadata before opening an Activity target.
It records the canonical kind on the tab and shows a brief unavailable message for a
deleted or inaccessible target.

## `src/lib/data/workspace.ts` and `src/lib/features/shell/WorkSurface.svelte`

### Preserve a known canonical kind on resource tabs

Tabs now optionally serialize their family kind. The surface prefers that value for an
Activity-opened target, but keeps the old local catalog lookup as a compatibility path
for existing mock and persisted tabs.

## Documentation

### Mark the backend request as shipped and preserve the remaining boundary

The backend request, discrepancy inventory, orientation guide, and source companions
now distinguish real Activity from the still-local resource table and purpose statement.
They describe the snapshot-first, resolve-on-selection contract for reviewers.

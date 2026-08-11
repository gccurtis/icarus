# `lens-helpers.ts`

Pure projections behind the three Overview inspector lenses. They live outside the lens components
so they can be tested directly; `lens-helpers.test.ts` covers every function here.

## The access rule moved out (2026-07-29)

`REDACTED_LABEL`, `deletedTargetIds`, and `isTargetRedacted` used to live here — the reason this file
existed in the first place. They now live in
[`features/shared/activity-access.ts`](../../shared/activity-access.ts.md), because the context rail's
History lens renders activity too and the shell must not import from a stage. Overview's consumers
(`ActivityFeed`, `ActivityLens`) import them from `shared/` directly; nothing is re-exported through
here, since a facade forwarding someone else's module is exactly what the L1–L3 cleanup deleted.

Read that companion for the disclosure the rule closes and why it fails closed.

## The caps

```ts
export const FEED_EVENT_CAP = 100;
export const RESOURCE_EVENT_CAP = 25;
```

`FEED_EVENT_CAP` matches Omega's own `activity.MaxLimit`, which is the most a single request may
ask for — so the feed agrees with the backend's ceiling rather than inventing one. Without it the
Overview feed pages forever as you scroll, and "all of this project's history" is not a question
this surface answers. On reaching it the feed stops calling `loadMore` and says *Showing the latest
100 events*, because a list that silently stops looks identical to one that ran out.

`RESOURCE_EVENT_CAP` bounds a single resource's list. Small on purpose: it lives inside an inspector
panel behind a fixed-height scroller, and its job is "what has been happening lately", not an audit
log. Both lenses label the list `latest 25` once it is reached.

(`accessSummary` used to live here. It went with the Access row when the resource lens was reduced
to Updated and Owner — nothing else used it.)

## Multi-selection projections

`kindBreakdown` counts kinds largest-first (ties broken by label, so the order is stable rather than
insertion-dependent), and `updatedSpan` returns the newest/oldest update times, or `null` for an
empty set so the lens can omit the block entirely rather than render "Invalid Date".

# 2026-07-29 — History stops being a promise

Third of five changes rebuilding the left rail's project-context set (plan:
[`docs/plans/2026-07-29-project-context-rail.md`](../../plans/2026-07-29-project-context-rail.md)).
The lens had been two sentences saying "the view arrives in a later increment" for months. It is now
the project's whole timeline.

## The lens

Day-grouped, cursor-paged, and — unlike the Overview stage's Activity box — **uncapped**:

```svelte
{#if nextCursor}
  <Button …>Load more</Button>
{:else}
  <p …>That’s the whole history.</p>
{/if}
```

The stage feed stops at `FEED_EVENT_CAP` (100) because "all of this project's history" is not a
question a 224px box should pretend to answer. This lens *is* the surface that answers it, so it pages
until Omega has no next cursor and then says so — a list that silently stops offering more is
indistinguishable from one that ran out.

Rows are **target-first**, which the browser decided. The first draft read like the stage feed (actor,
action, target in one sentence) and wrapped to three lines per event in a 220px rail with an
email-derived display name — ten events filled the panel. Leading with the resource name and demoting
who/what/when to one muted caption line halves the height, and the resource name is what you scan a
history for.

A row **opens its target** rather than driving the inspector. The lens that renders what a change
changed (`ActivityLens`) belongs to the Overview stage's *inspector* contribution, and this rail
outlives that stage — it is still on screen while a document is open, where such a click would have
nowhere to render. Jumping the work surface back to Overview on a rail click was considered and
rejected as surprising.

## The access rule moved to `shared/`, unchanged

The shell must not import from a stage (AGENTS.md → ownership-is-the-tree), and this lens needs the
same redaction rule `ActivityFeed` uses. So `REDACTED_LABEL`, `deletedTargetIds`, and
`isTargetRedacted` moved from `stages/overview/lens-helpers.ts` to
`features/shared/activity-access.ts`, with their tests and their (good) companion prose.

Two things were deliberate:

- **No re-export was left behind.** Overview's own consumers now import from `shared/` directly. A
  facade forwarding someone else's module is precisely what the L1–L3 cleanup deleted.
- **The caps stayed stage-local.** `FEED_EVENT_CAP`/`RESOURCE_EVENT_CAP` are product decisions about
  two Overview surfaces, not shared knowledge — and this lens deliberately disagrees with the first
  of them.

The paging interaction is now written down where the rule lives: because History pages, a deletion
that has not loaded yet cannot exempt its older events, so a target can read `Redacted` until the page
carrying its `deleted` event arrives. Failing closed in that window is the correct trade.

## Day grouping is a tested projection, not inline markup

```ts
export function groupEventsByDay(events: ActivityEvent[], now = Date.now()): ActivityDay[]
```

Two mistakes here produce a plausible-looking wrong list, so both are pinned by tests: a day's events
routinely arrive in **two different pages** and must land in one group, and "same day" means the same
local calendar date — 23:30 yesterday and 00:30 today are an hour apart and belong to different days.
Groups key on the date, never the label, because two days a week apart can both render as "Thu" and a
label collision would merge them.

`dayLabel` came out of `activityStamp` in `$data/time` so the rail's headings and the feed's per-event
stamps cannot disagree about where a day starts; `clockTime` is the new time-only formatter for rows
that already sit under a day heading. Both take an injectable `now`, which is what lets the tests
assert boundaries without depending on the wall clock.

## Verification

`pnpm check` 0 errors / 0 warnings · `pnpm test` 410 → **416 passing** (6 new for day grouping; the 6
redaction tests moved with their rule) · `verify-companions` OK on all seven touched sources ·
`pnpm exec playwright test e2e/context-rail.spec.ts` 3/3, including a new case that walks the
timeline and opens a target from it.

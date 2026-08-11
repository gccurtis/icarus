# HistoryPanel.svelte

The project-context rail's **History** lens: this project's whole activity timeline, grouped by day.

> **Written 2026-07-29 (the context-rail pass).** This file was a two-sentence placeholder promising
> "the view arrives in a later increment". Document history remains a separate surface view — this is
> the project one.

## What makes it different from the stage's Activity box

The Overview stage's `ActivityFeed` holds about eight rows in a fixed-height panel and answers *what
just happened*. This lens answers *what has happened*, and the difference shows up as one deliberate
omission:

```svelte
const PAGE = 25;
…
{#if nextCursor}
  <Button …>Load more</Button>
{:else}
  <p …>That’s the whole history.</p>
{/if}
```

There is **no total cap**. The stage feed stops at `FEED_EVENT_CAP` (100) because "all of this
project's history" is not a question a 224px box should pretend to answer; this lens is the surface
that does answer it, so it pages by cursor until Omega says there is no next one — and then says so. A
list that silently stops offering more is indistinguishable from one that ran out, which is why the
end state is a sentence rather than an absent button.

## Filtering

The head block is fixed (the same anatomy as All resources): a `Filter…` button that becomes
`Filtered · N`, and one removable chip per active dimension.

```svelte
<button … onclick={() => applyFilter(chip.clear(filter))} aria-label={`Remove filter ${chip.label}`}>
```

The model, the predicate, and the dialog are shared —
[`activity-filter.ts`](../../shared/activity-filter.ts.md) and
[`ActivityFilterDialog.svelte`](../../shared/ActivityFilterDialog.svelte.md) — and the Overview stage's
Activity box uses both, so the two surfaces cannot disagree about what a filter means.

Three things are specific to this lens:

**It takes the server path when it can.** `serverTargetId(filter)` is passed to `loadActivityPage`, so
a filter naming exactly one resource is narrowed by Omega itself (`/activity?targetID=`) — exact, and
it pages only that resource's events. Applying a filter therefore *reloads* rather than re-filtering
what is loaded, because the request itself changes.

**It chases matches, but only so far.**

```svelte
const AUTO_PAGES = 4;
const ENOUGH_MATCHES = 5;
```

A person or kind filter is a predicate over loaded pages, so a filtered view can page a long way
before its first match — and "no matches" sitting next to a `Load more` button is technically true and
useless. So it auto-pages up to four times, then stops and hands the user the button. Bounded on
purpose: unbounded auto-paging is a request storm on a project with years of history.

**It always states the scope.**

```svelte
{shown.length} of {events.length} searched{nextCursor ? '' : ' — the whole history'}
```

`3 matches` alone would imply the whole history had been searched. The line names what was actually
looked at, and says explicitly when that happens to *be* everything.

## Rows are target-first, and that was measured

```svelte
<button …>{redacted ? REDACTED_LABEL : ev.target.name}</button>
<p class="flex …text-caption text-muted">
  <IdentityHoverCard … showAvatar portalled />
  <span class="min-w-0 truncate">{ev.actor.name}</span> · {ev.action} · {clockTime(ev.occurredAt)}
</p>
```

The first draft read like the stage feed — actor, then action, then target, in one flowing sentence. In
a 220px rail with an email-derived display name that wrapped to **three lines per event**, so ten
events filled the panel. Leading with the resource name (the thing you scan a history for) and
demoting who/what/when to one muted line halves the height. The actor's name truncates; the full
identity is in the hover card, which is the same `IdentityHoverCard` the stage feed uses, resolved the
same lazy way (`resolveFromUserId`, falling back to the name-keyed directory).

The day heading carries the date, so rows show `clockTime` alone rather than repeating it.

## A row opens its target — it does not inspect

```svelte
async function open(target: ActivityTarget, redacted: boolean) {
  if (redacted) { toast('You don’t have access to that resource.', …); return; }
```

The lens that renders *what a change actually changed* is `ActivityLens`, contributed to the
**inspector** by the Overview stage. This rail outlives that stage — it is still on screen when a
document is open — so a row click that tried to drive that inspector would have nowhere to render.
Opening the target is the gesture that works from everywhere. (The alternative, jumping the work
surface back to Overview on a rail click, was rejected as surprising.)

A redacted row is `disabled` and toasts if reached: the user is not entitled to know which resource it
was, so there is nothing to open.

## Access and paging interact

```svelte
const redactedIds = $derived(new Set($resourcesLoaded ? …filter(isTargetRedacted)… : events.map((ev) => ev.id)));
```

The shared rule from [`activity-access.ts`](../../shared/activity-access.ts.md): `/activity` ships
every event's target regardless of access, so a target absent from the access-filtered catalog is
redacted unless this feed has already reported its deletion. Until `resourcesLoaded`, **everything** is
redacted — an empty catalog must never read as "all clear".

One consequence is specific to this lens: because it pages, a deletion that has not loaded yet cannot
exempt its older events, so an old row may read `Redacted` until the page carrying its `deleted` event
arrives. Failing closed in that window is the correct trade.

## Project switching

```svelte
$effect(() => { projectId; void loadFirst(); });
```

An `$effect` on the id, not `onMount`: a panel is not remounted when the active project changes. Every
load carries a `generation` number and drops its result if another load has started since — the same
guard the stage feed uses, and the reason a fast project switch cannot leave the previous project's
events on screen.

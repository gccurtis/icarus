# src/lib/features/stages/overview/ActivityFeed.svelte — breakdown

Companion to [ActivityFeed.svelte](ActivityFeed.svelte). The feed loads bounded
cursor pages from Omega and renders the historical actor/target snapshots with
lazily resolved identity profiles for each actor.

## Script — paginated activity with async profile resolution

### Imports, state, and profile resolution

```svelte
<script lang="ts">
  import { loadActivityPage, type ActivityEvent, type ActivityTarget } from '$data/projects';
  import { activityStamp } from '$data/time';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { IdentityHoverCard } from '$lib/components';

  let { projectId, onopen }: { projectId: string; onopen: (target: ActivityTarget) => void } = $props();

  const PAGE = 8;
  let events = $state<ActivityEvent[]>([]);
  let nextCursor = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');
  let generation = 0;
  let profiles = $state<Record<string, IdentityProfile>>({});

  // Resolve actor profiles lazily when events change. Uses Omega's
  // GET /users/:userID when an actor id is available, falling back to
  // the name-keyed mock directory for historical snapshots without an id.
  $effect(() => {
    const current = events;
    void (async () => {
      for (const ev of current) {
        if (profiles[ev.actor.id]) continue;
        const profile = await resolveFromUserId(ev.actor.id, ev.actor.name);
        profiles = { ...profiles, [ev.actor.id]: profile };
      }
    })();
  });

  // Load a fresh selected-project feed whenever the project changes. The generation
  // guard ignores a late response from the project that was just left.
  $effect(() => {
    projectId;
    void loadFirst();
  });

```

The `profiles` state map holds lazily-resolved `IdentityProfile` records keyed by
actor ID. The `$effect` runs whenever the `events` array is replaced (by `loadFirst`
or `loadMore`), iterating over new events and calling `resolveFromUserId` for any
actor ID not yet seen. `resolveFromUserId` hits Omega's `GET /users/:userID` when the
actor has a real server ID, falling back to the `MOCK_IDENTITIES` directory (by name)
for historical activity snapshots that predate server identity support. Already-resolved
profiles are skipped via the `profiles[ev.actor.id]` guard. The `generation` counter
prevents a late response for a previous project from overwriting the current feed.

### Feed loading: loadFirst and loadMore

```svelte
  async function loadFirst() {
    const request = ++generation;
    events = [];
    nextCursor = null;
    error = '';
    loading = true;
    try {
      const page = await loadActivityPage(projectId, null, PAGE);
      if (request !== generation) return;
      events = page.events;
      nextCursor = page.nextCursor;
    } catch {
      if (request === generation) error = 'Activity could not be loaded.';
    } finally {
      if (request === generation) loading = false;
    }
  }

  async function loadMore() {
    if (loading || !nextCursor) return;
    const request = generation;
    const cursor = nextCursor;
    loading = true;
    error = '';
    try {
      const page = await loadActivityPage(projectId, cursor, PAGE);
      if (request !== generation) return;
      events = [...events, ...page.events];
      nextCursor = page.nextCursor;
    } catch {
      if (request === generation) error = 'More activity could not be loaded.';
    } finally {
      if (request === generation) loading = false;
    }
  }
  // Reveal the next page as the user scrolls near the bottom of the feed.
  function onScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) void loadMore();
  }
</script>

```

`loadFirst` resets the feed for a new project and fetches the first cursor page.
`loadMore` appends additional pages using the current cursor. Both use the generation
guard to discard stale responses. `onScroll` triggers `loadMore` when the user is
within 24px of the bottom.

### Markup

```svelte
<section class="flex h-full min-h-0 flex-col">
  <p class="mb-2 text-label uppercase tracking-wide text-muted">Activity</p>

  <!-- Bordered, background-free, divided list; every part is interactive; loads more on scroll. -->
  <div onscroll={onScroll} class="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] rounded-panel border border-border">
    <ul class="divide-y divide-border">
      {#each events as ev (ev.id)}
        <li class="dur-micro px-2 py-2 transition-colors hover:bg-panel/40">
          <p class="text-body-sm leading-relaxed text-secondary">
            <IdentityHoverCard profile={profiles[ev.actor.id] ?? getIdentityProfile(ev.actor.name)} showAvatar showName portalled />
            {ev.action}
            {#if ev.action === 'deleted'}
              <span class="font-medium text-primary">{ev.target.name}</span>
            {:else}
              <button
                type="button"
                onclick={() => onopen(ev.target)}
                class="dur-micro font-medium text-primary transition-colors hover:text-action hover:underline"
              >
                {ev.target.name}
              </button>
            {/if}
          </p>
          <p class="mt-0.5 text-caption text-muted">{activityStamp(ev.occurredAt)}</p>
        </li>
      {/each}
    </ul>
    {#if loading && events.length === 0}
      <p class="px-2 py-3 text-caption text-muted">Loading activity…</p>
    {:else if error}
      <p class="px-2 py-3 text-caption text-danger">{error}</p>
    {:else if events.length === 0}
      <p class="px-2 py-3 text-caption text-muted">No activity yet.</p>
    {:else if !nextCursor}
      <p class="px-2 py-3 text-caption text-muted">You're all caught up.</p>
    {/if}
  </div>
</section>
```

Each event row pairs an `IdentityHoverCard` (left-aligned actor avatar + name with
hover card) with the action and interactive (or deleted) target. The actor profile is
read from the `profiles` map keyed by `ev.actor.id`; if the profile has not resolved
yet, `getIdentityProfile(ev.actor.name)` returns a synchronous fallback from the mock
directory. The `portalled` prop renders the hover card in a portal so it escapes the
scroll container's overflow. Deleted targets intentionally remain text: their snapshot
is still useful history but their canonical target cannot be opened.

`activityStamp` imports from `$data/time` — a shared time-formatting utility, not
overview-specific logic. The `[scrollbar-width:none]` utility class hides the scrollbar
in the feed container while preserving scroll functionality.

## Filtering (2026-07-29)

```svelte
let filter = $state<ActivityFilter>({ ...EMPTY_FILTER });
const shown = $derived(filterEvents(events, filter));
```

One small button in the eyebrow row opens the **same** dialog the context rail's History lens uses
([`ActivityFilterDialog`](../../shared/ActivityFilterDialog.svelte.md)) over the same model and
predicate ([`activity-filter.ts`](../../shared/activity-filter.ts.md)), so the two surfaces cannot
disagree about what a filter means. `{#each shown …}` replaces `{#each events …}`; nothing else about
the list changes.

Three deliberate differences from the rail's lens:

- **No chips.** This box is 224px tall and the rows are what it is for, so the button itself carries
  the state (tinted, with the number of active dimensions).
- **Client-side only.** No `serverTargetId` path: this feed caps at `FEED_EVENT_CAP` and pages by
  scroll, so re-fetching with `targetID` would buy nothing the predicate does not already give.
- **Filter state is per-instance and not persisted.** It is a momentary "just show me Ada's edits"; a
  glance box that reopened tomorrow still hiding most of the project's activity would read as broken.

Filtered to nothing, the empty line names the scope (`No matches in the latest N events`) rather than
saying "no activity" — the predicate only sees the pages loaded so far, and scrolling loads more.

## Redaction — the feed is the leak, not the table

```ts
const visibleIds = $derived(new Set($resources.map((r) => r.id)));
const deletedIds = $derived(deletedTargetIds(events));
const redactedIds = $derived(
  new Set(
    $resourcesLoaded
      ? events.filter((ev) => isTargetRedacted(ev, visibleIds, deletedIds)).map((ev) => ev.id)
      : []
  )
);
```

Omega filters `GET /resources` by access scope but performs **no** access check on `GET /activity`,
so this feed receives the id, name, and kind of resources the catalog deliberately withheld. The
catalog is therefore the authority on what may be shown, and a target absent from it — and not
proven deleted by a `deleted` event already loaded — renders as the single word **Redacted**, not a
link and with no name.

The decision is made here, once, and passed to the lens as a prop, so a row and its inspector can
never disagree about whether a name is safe. The rule itself lives in
[`features/shared/activity-access.ts`](../../shared/activity-access.ts.md) — it moved out of this
stage's `lens-helpers.ts` on 2026-07-29 when the context rail's History lens needed the same rule and
could not import from a stage; the caps (`FEED_EVENT_CAP`) stayed stage-local. The server-side fix is
filed in
[`resource-access-enforcement.md`](../../../../../docs/backend-requests/resource-access-enforcement.md).

The `$resourcesLoaded` gate is not a nicety. Rendering the list first and redacting once the catalog
arrives would put the very names this hides on screen for a moment — so the list carries `hidden`
until then and the existing "Loading activity…" state covers the beat.

## The feed stops at 100

```ts
const capped = $derived(events.length >= FEED_EVENT_CAP);
async function loadMore() {
  if (loading || !nextCursor || events.length >= FEED_EVENT_CAP) return;
```

Scrolling used to page forever. `FEED_EVENT_CAP` matches Omega's `activity.MaxLimit`, so the client
agrees with the backend's own ceiling instead of inventing one, and the tail message changes to
*Showing the latest 100 events* — distinct from *You're all caught up*, because "there is more, we
stopped" and "that is everything" are different facts and a silently truncated list reads as the
second.

## Rows are click targets

Each entry's handlers sit on a wrapper `<div role="button">` inside the `<li>` rather than on the
`<li>` itself — a list item is not an interactive element, and Svelte's a11y check says so. The
click handler ignores anything that lands on a control (`closest('button, a')`), so the actor
hover-card and the target link keep their own meanings and only the surrounding area inspects. The
`<ul>` carries `aria-label="Project activity"`, which is what makes the feed addressable
independently of the resource table on the same screen.

<script lang="ts">
  import { ListFilter } from '@lucide/svelte';
  import { loadActivityPage, roster, loadRoster, type ActivityEvent, type ActivityTarget } from '$data/projects';
  import { activityStamp } from '$data/time';
  import { resources, resourcesLoaded } from '$data/resources';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { IdentityHoverCard } from '$lib/components';
  import { cn } from '$lib/utils';
  import { deletedTargetIds, isTargetRedacted, REDACTED_LABEL } from '$lib/features/shared/activity-access';
  import { kindPluralLabel } from '$lib/features/shared/kinds';
  import ActivityFilterDialog from '$lib/features/shared/ActivityFilterDialog.svelte';
  import {
    EMPTY_FILTER,
    filterChips,
    filterEvents,
    isFilterActive,
    type ActivityFilter
  } from '$lib/features/shared/activity-filter';
  import { FEED_EVENT_CAP } from './lens-helpers';

  let {
    projectId,
    onopen,
    inspectedId = null,
    oninspect
  }: {
    projectId: string;
    onopen: (target: ActivityTarget) => void;
    /** The event drawn as inspected. */
    inspectedId?: string | null;
    /** An entry was clicked somewhere other than the actor or the target link. */
    oninspect?: (event: ActivityEvent, redacted: boolean) => void;
  } = $props();

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

  /** Reached the cap: stop paging and say so rather than scroll forever. */
  const capped = $derived(events.length >= FEED_EVENT_CAP);

  /**
   * The filter — the same model, dialog, and predicate the rail's History lens uses
   * (`features/shared/activity-filter.ts`).
   *
   * It is applied client-side only here, deliberately: this box scrolls to page and
   * caps at `FEED_EVENT_CAP`, so re-fetching with `targetID` for a single-resource
   * filter would buy nothing the predicate does not already give. The rail's lens,
   * which pages without a cap, does take that server path.
   *
   * Filter state is per-instance and not persisted: it is a momentary "just show me
   * Ada's edits", and a glance box that reopened tomorrow still hiding most of the
   * project's activity would read as broken.
   */
  let filter = $state<ActivityFilter>({ ...EMPTY_FILTER });
  let filterOpen = $state(false);

  const shown = $derived(filterEvents(events, filter));
  const filtering = $derived(isFilterActive(filter));
  const filterCount = $derived(
    filterChips(filter, { actor: () => undefined, resource: () => undefined, kind: kindPluralLabel }).length
  );

  // The roster feeds the dialog's person list, plus any actor the feed has shown (a
  // former member, or an agent, still appears in history).
  $effect(() => {
    if (projectId) void loadRoster(projectId);
  });
  const actors = $derived.by(() => {
    const seen = new Map<string, string>();
    if ($roster.projectId === projectId) for (const m of $roster.members) seen.set(m.id, m.name);
    for (const ev of events) if (!seen.has(ev.actor.id)) seen.set(ev.actor.id, ev.actor.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  async function loadMore() {
    if (loading || !nextCursor || events.length >= FEED_EVENT_CAP) return;
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

  /**
   * The access decision, made here because this is the only surface that needs
   * it: Omega's `/activity` performs no access check and ships every event's
   * target name, while `/resources` is filtered. The catalog is therefore the
   * authority on what this user may know exists.
   *
   * Held off until `resourcesLoaded` — an empty catalog mid-load would redact
   * the whole feed, and the feed's own loading state already covers that beat.
   */
  const visibleIds = $derived(new Set($resources.map((r) => r.id)));
  const deletedIds = $derived(deletedTargetIds(events));
  const redactedIds = $derived(
    new Set(
      $resourcesLoaded
        ? events.filter((ev) => isTargetRedacted(ev, visibleIds, deletedIds)).map((ev) => ev.id)
        : []
    )
  );

  function inspect(e: MouseEvent, ev: ActivityEvent) {
    if ((e.target as HTMLElement).closest('button, a')) return;
    oninspect?.(ev, redactedIds.has(ev.id));
  }
  function inspectKey(e: KeyboardEvent, ev: ActivityEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    oninspect?.(ev, redactedIds.has(ev.id));
  }
</script>

<section class="flex h-full min-h-0 flex-col">
  <div class="mb-2 flex items-center justify-between gap-2">
    <p class="text-label uppercase tracking-wide text-muted">Activity</p>
    <!--
      The same filter the rail's History lens builds, from the same dialog and the
      same predicate. No chips here: this box is 224px tall and the rows are what it
      is for, so the button itself carries the state.
    -->
    <button
      type="button"
      onclick={() => (filterOpen = true)}
      aria-label={filtering ? `Filtered by ${filterCount}` : 'Filter activity'}
      class={cn(
        'dur-micro flex items-center gap-1 rounded-control px-1.5 py-0.5 text-caption transition-colors',
        filtering ? 'bg-action/10 text-action' : 'text-muted hover:bg-elevated hover:text-primary'
      )}
    >
      <ListFilter class="size-3.5" />
      {#if filtering}{filterCount}{/if}
    </button>
  </div>

  <!-- Bordered, background-free, divided list; every part is interactive; loads more on scroll. -->
  <div onscroll={onScroll} class="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] rounded-panel border border-border">
    <!-- Nothing renders until the catalog has answered. Drawing the list first and
         redacting a moment later would put the very names this hides on screen. -->
    <ul aria-label="Project activity" class={cn('divide-y divide-border', !$resourcesLoaded && 'hidden')}>
      {#each shown as ev (ev.id)}
        {@const redacted = redactedIds.has(ev.id)}
        <li>
          <!-- The role sits on this wrapper, not the <li>: a list item is not an
               interactive element, and the entry stays part of a real list. -->
          <div
            role="button"
            tabindex="0"
            aria-pressed={ev.id === inspectedId}
            onclick={(e) => inspect(e, ev)}
            onkeydown={(e) => inspectKey(e, ev)}
            class={cn(
              'dur-micro relative px-2 py-2 outline-none transition-colors hover:bg-panel/40 focus-visible:bg-panel/40',
              ev.id === inspectedId && 'bg-panel/60'
            )}
          >
          {#if ev.id === inspectedId}
            <span class="absolute left-0 top-0 h-full w-0.5 bg-action" aria-hidden="true"></span>
          {/if}
          <p class="text-body-sm leading-relaxed text-secondary">
            <IdentityHoverCard profile={profiles[ev.actor.id] ?? getIdentityProfile(ev.actor.name)} showAvatar showName portalled />
            {ev.action}
            {#if redacted}
              <!-- Not a link and not the real name: this user is not entitled to
                   know which resource this was. -->
              <span class="font-medium text-muted italic">{REDACTED_LABEL}</span>
            {:else if ev.action === 'deleted'}
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
          </div>
        </li>
      {/each}
    </ul>
    {#if !$resourcesLoaded || (loading && events.length === 0)}
      <p class="px-2 py-3 text-caption text-muted">Loading activity…</p>
    {:else if error}
      <p class="px-2 py-3 text-caption text-danger">{error}</p>
    {:else if events.length === 0}
      <p class="px-2 py-3 text-caption text-muted">No activity yet.</p>
    {:else if shown.length === 0}
      <!-- Filtered to nothing: name the scope, since the predicate only sees the
           pages loaded so far. Scrolling loads more and re-applies it. -->
      <p class="px-2 py-3 text-caption text-muted">
        No matches in the latest {events.length} events.
      </p>
    {:else if capped}
      <p class="px-2 py-3 text-caption text-muted">
        Showing the latest {FEED_EVENT_CAP} events.
      </p>
    {:else if !nextCursor}
      <p class="px-2 py-3 text-caption text-muted">You're all caught up.</p>
    {/if}
  </div>
</section>

<ActivityFilterDialog
  bind:open={filterOpen}
  {filter}
  resources={$resources}
  {actors}
  onapply={(next) => (filter = next)}
/>

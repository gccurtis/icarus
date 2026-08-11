<script lang="ts">
  import { untrack } from 'svelte';
  import { ListFilter, X } from '@lucide/svelte';
  import { loadActivityPage, getResourceMetadata, roster, loadRoster, type ActivityEvent, type ActivityTarget } from '$data/projects';
  import { resources, resourcesLoaded } from '$data/resources';
  import { workspace, openTab } from '$data/workspace';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { clockTime } from '$data/time';
  import { Button, IdentityHoverCard, PanelResults, Spinner, toast } from '$lib/components';
  import { cn } from '$lib/utils';
  import { kindPluralLabel } from '$lib/features/shared/kinds';
  import { deletedTargetIds, isTargetRedacted, REDACTED_LABEL } from '$lib/features/shared/activity-access';
  import { groupEventsByDay } from '$lib/features/shared/activity-timeline';
  import ActivityFilterDialog from '$lib/features/shared/ActivityFilterDialog.svelte';
  import {
    EMPTY_FILTER,
    filterChips,
    filterEvents,
    isFilterActive,
    serverTargetId,
    type ActivityFilter
  } from '$lib/features/shared/activity-filter';

  /**
   * Project context → History: the whole activity timeline, grouped by day.
   *
   * The Overview stage's Activity box holds about eight rows in a fixed-height
   * panel and answers "what just happened". This is the surface that answers "what
   * has happened" — so unlike that feed it has NO total cap: `/activity` pages by
   * cursor, and this keeps asking until Omega says there is no more.
   */
  const PAGE = 25;
  /**
   * How hard a filter chases matches before handing the user the button.
   *
   * A filtered view can page a long way before its first match, and a panel that
   * showed "no matches" next to a Load more button would be technically true and
   * useless. So it auto-pages a bounded number of times, then stops and says how far
   * it has looked — bounded, because unbounded auto-paging is a request storm on a
   * project with years of history.
   */
  const AUTO_PAGES = 4;
  const ENOUGH_MATCHES = 5;

  let events = $state<ActivityEvent[]>([]);
  let nextCursor = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');
  let generation = 0;
  let profiles = $state<Record<string, IdentityProfile>>({});
  let filter = $state<ActivityFilter>({ ...EMPTY_FILTER });
  let filterOpen = $state(false);

  const projectId = $derived($workspace?.projectId ?? '');

  /**
   * Reload from scratch whenever the active project changes. A panel is not
   * remounted on a project switch, so this has to be an `$effect` on the id.
   *
   * `untrack` is load-bearing, not defensive: the body resets `filter`, and
   * `loadFirst` READS `filter` (for the `targetID` path) inside the effect's
   * synchronous stack. Tracked, that is a write to a dependency of the same effect —
   * it re-ran forever and the lens sat on "Loading history…" until this was fixed.
   */
  $effect(() => {
    projectId;
    untrack(() => {
      filter = { ...EMPTY_FILTER };
      void loadFirst();
    });
  });

  // The roster feeds the filter's person list (shared with the Properties and
  // Members lenses, so flipping sections costs one request).
  $effect(() => {
    if (projectId) void loadRoster(projectId);
  });

  // Actor profiles resolve lazily, exactly as the stage feed does it — Omega's
  // GET /users/:userID when an id is available, falling back to the name-keyed
  // directory for older snapshots without one.
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

  async function loadFirst() {
    const request = ++generation;
    events = [];
    nextCursor = null;
    error = '';
    if (!projectId) return;
    loading = true;
    try {
      // A filter naming exactly one resource is narrowed by Omega itself
      // (`/activity?targetID=`) — exact, and it pages only that resource's events.
      const page = await loadActivityPage(projectId, null, PAGE, serverTargetId(filter));
      if (request !== generation) return;
      events = page.events;
      nextCursor = page.nextCursor;
    } catch {
      if (request === generation) error = 'Could not load this project’s history.';
      return;
    } finally {
      if (request === generation) loading = false;
    }
    await chaseMatches(request);
  }

  async function loadMore() {
    if (loading || !nextCursor || !projectId) return;
    const request = generation;
    loading = true;
    try {
      const page = await loadActivityPage(projectId, nextCursor, PAGE, serverTargetId(filter));
      if (request !== generation) return;
      events = [...events, ...page.events];
      nextCursor = page.nextCursor;
    } catch {
      if (request === generation) error = 'Could not load more history.';
    } finally {
      if (request === generation) loading = false;
    }
  }

  /** Keep paging while a filter has found too little, up to `AUTO_PAGES` times. */
  async function chaseMatches(request: number) {
    if (!isFilterActive(filter)) return;
    for (let i = 0; i < AUTO_PAGES; i++) {
      if (request !== generation || !nextCursor) return;
      if (filterEvents(events, filter).length >= ENOUGH_MATCHES) return;
      await loadMore();
    }
  }

  function applyFilter(next: ActivityFilter) {
    filter = next;
    // The server-side path changes with the filter (targetID appears or goes away),
    // so a filter change is a reload rather than a re-filter of what is loaded.
    void loadFirst();
  }

  // The access rule (shared with the stage feed): /activity ships every event's
  // target regardless of access, so a target absent from the access-filtered
  // catalog is redacted unless this feed has already reported its deletion. Held
  // off until the catalog has loaded, or an empty list would redact everything.
  const visibleIds = $derived(new Set($resources.map((r) => r.id)));
  const deletedIds = $derived(deletedTargetIds(events));
  const redactedIds = $derived(
    new Set(
      $resourcesLoaded
        ? events.filter((ev) => isTargetRedacted(ev, visibleIds, deletedIds)).map((ev) => ev.id)
        : events.map((ev) => ev.id)
    )
  );

  const shown = $derived(filterEvents(events, filter));
  const days = $derived(groupEventsByDay(shown));
  const filtering = $derived(isFilterActive(filter));

  // Everyone who could have acted: the roster, plus any actor the feed has shown
  // (a former member, or an agent, still appears in history).
  const actors = $derived.by(() => {
    const seen = new Map<string, string>();
    if ($roster.projectId === projectId) for (const m of $roster.members) seen.set(m.id, m.name);
    for (const ev of events) if (!seen.has(ev.actor.id)) seen.set(ev.actor.id, ev.actor.name);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const chips = $derived(
    filterChips(filter, {
      actor: (id) => actors.find((a) => a.id === id)?.name,
      resource: (id) => $resources.find((r) => r.id === id)?.name,
      kind: kindPluralLabel
    })
  );

  /**
   * A row opens its target. It does NOT drive the inspector: the lens that renders
   * a change belongs to the Overview stage's inspector contribution, and this rail
   * outlives that stage — a click from inside a document would have nowhere to
   * render.
   */
  async function open(target: ActivityTarget, redacted: boolean) {
    if (redacted) {
      toast('You don’t have access to that resource.', { tone: 'attention' });
      return;
    }
    try {
      const resource = await getResourceMetadata(target.kind, target.id);
      openTab(resource.name, resource.id, resource.kind);
    } catch {
      toast('This resource is no longer available.', { tone: 'attention' });
    }
  }
</script>

<!-- Project-context History: the long timeline. Document history is a separate surface view. -->
<div class="flex h-full flex-col">
  <!-- Fixed head: the way to filter, and what is currently being filtered by. -->
  <div class="shrink-0 space-y-1.5 pt-1">
    <Button
      variant={filtering ? 'secondary' : 'ghost'}
      size="sm"
      class="w-full"
      onclick={() => (filterOpen = true)}
    >
      <ListFilter class={cn('size-4', filtering && 'text-action')} />
      {filtering ? `Filtered · ${chips.length}` : 'Filter…'}
    </Button>

    {#if chips.length}
      <div class="flex flex-wrap gap-1">
        {#each chips as chip (chip.key)}
          <button
            type="button"
            onclick={() => applyFilter(chip.clear(filter))}
            class="dur-micro flex max-w-full items-center gap-1 rounded-control bg-action/10 px-1.5 py-0.5 text-caption text-action transition-colors hover:bg-action/20"
            aria-label={`Remove filter ${chip.label}`}
          >
            <span class="min-w-0 truncate">{chip.label}</span>
            <X class="size-3 shrink-0" />
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <PanelResults class="pt-1">
    {#if error}
      <p class="py-2 text-body-sm text-danger">{error}</p>
    {/if}

    {#if !events.length && loading}
      <div class="flex items-center gap-2 py-3 text-body-sm text-muted">
        <Spinner class="size-4" />
        Loading history…
      </div>
    {:else if !events.length && !error}
      <p class="py-3 text-body-sm text-muted">Nothing has happened in this project yet.</p>
    {:else if !shown.length && !error}
      <!-- Filtered to nothing: say what was searched, not just "no results". The
           footer's Load more is how you look further back. -->
      <p class="py-3 text-body-sm text-muted">
        No matches in the {events.length} {events.length === 1 ? 'event' : 'events'} loaded so far.
      </p>
    {/if}

    {#each days as day (day.key)}
      <p class="pt-3 pb-1 text-label uppercase tracking-wide text-muted">{day.label}</p>
      <ul class="space-y-0.5">
        {#each day.events as ev (ev.id)}
          {@const redacted = redactedIds.has(ev.id)}
          <!--
            Target first, then who/what/when as one muted line. The rail is 220px
            wide: leading with the actor's name pushed the resource — the thing you
            scan a history for — onto a third line for every single event.
          -->
          <li class="min-w-0 py-0.5">
            <button
              type="button"
              onclick={() => open(ev.target, redacted)}
              disabled={redacted}
              class={cn(
                'dur-micro block w-full truncate rounded-control px-1 py-0.5 text-left text-body-sm font-medium transition-colors',
                redacted
                  ? 'cursor-default text-muted italic'
                  : 'text-primary hover:bg-elevated hover:text-action'
              )}
            >
              {redacted ? REDACTED_LABEL : ev.target.name}
            </button>
            <p class="flex min-w-0 items-center gap-1 px-1 text-caption text-muted">
              <!-- Same identity treatment as the stage feed: the resolved profile
                   when it has arrived, the name-keyed directory entry until then. -->
              <IdentityHoverCard
                profile={profiles[ev.actor.id] ?? getIdentityProfile(ev.actor.name)}
                showAvatar
                portalled
              />
              <span class="min-w-0 truncate">{ev.actor.name}</span>
              <span aria-hidden="true">·</span>
              <span class="shrink-0">{ev.action}</span>
              <span aria-hidden="true">·</span>
              <span class="shrink-0">{clockTime(ev.occurredAt)}</span>
            </p>
          </li>
        {/each}
      </ul>
    {/each}

    {#if events.length}
      <div class="space-y-1.5 py-3">
        {#if nextCursor}
          <Button variant="ghost" size="sm" class="w-full" disabled={loading} onclick={loadMore}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        {:else}
          <p class="text-center text-caption text-muted">That’s the whole history.</p>
        {/if}

        {#if filtering}
          <!--
            The scope of a filtered count, always stated. Person and kind filters are
            client-side predicates over the pages loaded so far (Omega's /activity has
            no actor or kind parameter), so "3 matches" without "of 50 events searched"
            would imply the whole history had been searched when it had not.
          -->
          <p class="text-center text-caption text-muted">
            {shown.length} of {events.length} searched{nextCursor ? '' : ' — the whole history'}
          </p>
        {/if}
      </div>
    {/if}
  </PanelResults>
</div>

<ActivityFilterDialog
  bind:open={filterOpen}
  {filter}
  resources={$resources}
  {actors}
  onapply={applyFilter}
/>

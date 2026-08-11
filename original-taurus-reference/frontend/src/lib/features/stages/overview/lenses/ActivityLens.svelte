<script lang="ts">
  import { EyeOff, ExternalLink } from '@lucide/svelte';
  import { IdentityHoverCard } from '$lib/components';
  import { cn } from '$lib/utils';
  import { iconTileClass } from '$data/projects';
  import { resources } from '$data/resources';
  import { loadActivityPage, type ActivityEvent } from '$data/projects';
  import { activityStamp } from '$data/time';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { openTab } from '$data/workspace';
  import { kindMeta } from '$lib/features/shared/kinds';
  import { REDACTED_LABEL } from '$lib/features/shared/activity-access';
  import { actionTitle, RESOURCE_EVENT_CAP } from '../lens-helpers';
  import { loadEventChange, type EventChange } from '../change-lookup';
  import { overviewProjectId } from '../overview-session';
  import ChangeDetail from './ChangeDetail.svelte';
  import ActivityList from './ActivityList.svelte';

  let { event, redacted }: { event: ActivityEvent; redacted: boolean } = $props();

  // Present in the access-filtered catalog = still exists and is visible. Absent
  // but not redacted means the feed proved it was deleted, so there is nothing
  // left to query and the lens says so rather than firing requests that 404.
  const live = $derived($resources.find((r) => r.id === event.target.id) ?? null);
  const deleted = $derived(!redacted && !live);
  const meta = $derived(kindMeta[event.target.kind]);
  const Icon = $derived(meta.icon);

  let actor = $state<IdentityProfile | null>(null);
  let others = $state<ActivityEvent[]>([]);
  let change = $state<EventChange | null>(null);
  let generation = 0;

  $effect(() => {
    const { id, name } = event.actor;
    actor = null;
    void resolveFromUserId(id, name).then((profile) => (actor = profile));
  });

  $effect(() => {
    const target = live;
    const current = event;
    const projectId = $overviewProjectId;
    const request = ++generation;
    others = [];
    change = null;
    if (!target || !projectId) return;

    // Other activity on the same resource, for the tail section. The inspected
    // event is dropped — it is the subject of everything above.
    void loadActivityPage(projectId, null, RESOURCE_EVENT_CAP, target.id).then((page) => {
      if (request === generation) others = page.events.filter((e) => e.id !== current.id);
    });

    // Change-level detail exists only for documents.
    if (target.kind !== 'document') return;
    change = { state: 'loading' };
    void loadEventChange(target.id, current).then((result) => {
      if (request === generation) change = result;
    });
  });
</script>

<div class="space-y-4">
  <!-- The document first: what this event happened to, and the way back to it.
       Redaction replaces it entirely — when the catalog says we may not know this
       resource exists, nothing about it shows. -->
  {#if redacted}
    <div class="flex items-center gap-2.5">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-control bg-panel text-muted">
        <EyeOff class="size-4" />
      </span>
      <div class="min-w-0">
        <p class="text-body-sm font-medium text-muted">{REDACTED_LABEL}</p>
        <p class="text-caption text-muted">You do not have access to this resource.</p>
      </div>
    </div>
  {:else}
    <div class="flex min-w-0 items-center gap-2.5">
      <span class={cn('flex size-8 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
        <Icon class="size-4" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-body-sm font-medium text-primary">{event.target.name}</p>
        <p class="text-caption text-muted">{deleted ? `${meta.label} · deleted` : meta.label}</p>
      </div>
      {#if live}
        <button
          type="button"
          onclick={() => openTab(live.name, live.id, live.kind)}
          aria-label="Open resource"
          title="Open"
          class="dur-small inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
        >
          <ExternalLink class="size-4" />
        </button>
      {/if}
    </div>
  {/if}

  <!-- Then the change itself: the reason the user clicked, answered without a
       second gesture. -->
  {#if change}
    <section class="border-t border-border pt-3">
      <p class="mb-2 text-label uppercase tracking-wide text-muted">Change</p>
      <ChangeDetail {change} />
    </section>
  {/if}

  <!-- Then attribution. It comes after the change because "what happened" outranks
       "who did it" when you have already chosen a row that names the actor. -->
  <section class="border-t border-border pt-3">
    <div class="flex items-baseline justify-between gap-3">
      <span class="shrink-0 text-caption text-muted">{actionTitle(event.action)} by</span>
      <IdentityHoverCard
        profile={actor ?? getIdentityProfile(event.actor.name)}
        showName
        portalled
        class="min-w-0"
      />
    </div>
    <p class="mt-1 text-right text-caption text-muted">{activityStamp(event.occurredAt)}</p>
  </section>

  <!-- Last: the rest of this resource's activity, each row expanding in place. -->
  {#if !redacted && live && others.length}
    <section class="border-t border-border pt-3">
      <div class="mb-2 flex items-baseline justify-between gap-2">
        <p class="text-label uppercase tracking-wide text-muted">
          Other activity on this {meta.label.toLowerCase()}
        </p>
        {#if others.length >= RESOURCE_EVENT_CAP - 1}
          <span class="shrink-0 text-caption text-muted">latest {RESOURCE_EVENT_CAP}</span>
        {/if}
      </div>
      <ActivityList events={others} documentId={live.kind === 'document' ? live.id : null} />
    </section>
  {/if}
</div>

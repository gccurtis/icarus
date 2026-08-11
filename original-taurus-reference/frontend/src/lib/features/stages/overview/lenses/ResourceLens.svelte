<script lang="ts">
  import { Building2, ExternalLink, Pin, Share2 } from '@lucide/svelte';
  import { Avatar, Button, IdentityHoverCard, Modal } from '$lib/components';
  import { cn } from '$lib/utils';
  import { iconTileClass } from '$data/projects';
  import { resources } from '$data/resources';
  import { currentUserId, fetchMembers, loadActivityPage, type ActivityEvent, type Member } from '$data/projects';
  import { organizations, loadOrganizations } from '$data/organizations';
  import { relativeTime } from '$data/time';
  import { resolveFromUserId } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { openTab } from '$data/workspace';
  import { kindMeta } from '$lib/features/shared/kinds';
  import { RESOURCE_EVENT_CAP } from '../lens-helpers';
  import { overviewProjectId } from '../overview-session';
  import ActivityList from './ActivityList.svelte';
  import ResourceSharing from '$lib/features/stages/shared/ResourceSharing.svelte';

  let { resourceId }: { resourceId: string } = $props();

  // Read the live catalog row rather than a snapshot, so a rename or a pin made
  // elsewhere is reflected while the lens is open — and so a resource deleted
  // under the selection degrades to an honest message instead of stale facts.
  const resource = $derived($resources.find((r) => r.id === resourceId) ?? null);

  let owner = $state<IdentityProfile | null>(null);
  let events = $state<ActivityEvent[]>([]);
  let timelineError = $state('');
  let shareOpen = $state(false);
  let members = $state<Member[]>([]);
  let generation = 0;

  // Only the resource's owner may change access (Omega answers 403 otherwise), so
  // anyone else gets the facts without a control that would fail.
  const canShare = $derived(
    !!resource && resource.kind === 'document' &&
      (!resource.creatorId || resource.creatorId === currentUserId())
  );

  // Who the access scope names. Member/org lookups only happen for a restricted
  // resource — a project-wide one needs no roster to describe itself.
  const restricted = $derived(!!resource && !resource.access.projectWide);
  const sharedPeople = $derived(
    !resource || !restricted
      ? []
      : resource.access.userIds.map((id) => ({
          id,
          name: members.find((m) => m.id === id)?.name ?? 'Unknown member'
        }))
  );
  const sharedOrgs = $derived(
    !resource || !restricted
      ? []
      : resource.access.orgIds.map((id) => ({
          id,
          name: $organizations.find((o) => o.id === id)?.name ?? 'Unknown organization'
        }))
  );

  $effect(() => {
    if (!restricted) return;
    const projectId = $overviewProjectId;
    if (!projectId) return;
    void fetchMembers(projectId).then((list) => (members = list)).catch(() => {});
    void loadOrganizations().catch(() => {});
  });

  $effect(() => {
    const creatorId = resource?.creatorId;
    owner = null;
    if (!creatorId) return;
    void resolveFromUserId(creatorId, '').then((profile) => (owner = profile));
  });

  // The per-resource feed works for every kind (Omega's targetID filter), which
  // is why it — not document history — is this lens's activity source.
  $effect(() => {
    const id = resourceId;
    const projectId = $overviewProjectId;
    const request = ++generation;
    events = [];
    timelineError = '';
    if (!projectId || !id) return;
    void loadActivityPage(projectId, null, RESOURCE_EVENT_CAP, id)
      .then((page) => {
        if (request === generation) events = page.events;
      })
      .catch(() => {
        if (request === generation) timelineError = 'Activity could not be loaded.';
      });
  });
</script>

{#if !resource}
  <p class="text-body-sm text-muted">This resource is no longer available.</p>
{:else}
  {@const meta = kindMeta[resource.kind]}
  {@const Icon = meta.icon}
  <div class="space-y-4">
    <!-- Identity: what you selected, stated once. -->
    <div class="flex min-w-0 items-center gap-2.5">
      <span class={cn('flex size-8 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
        <Icon class="size-4" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-body-sm font-medium text-primary">{resource.name}</p>
        <p class="flex items-center gap-1 text-caption text-muted">
          {meta.label}
          {#if resource.pinned}<Pin class="size-3 -rotate-45 fill-current" aria-label="Pinned" />{/if}
        </p>
      </div>
      <button
        type="button"
        onclick={() => openTab(resource.name, resource.id, resource.kind)}
        aria-label="Open resource"
        title="Open"
        class="dur-small inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
      >
        <ExternalLink class="size-4" />
      </button>
    </div>

    <!-- Updated only. Created was dropped as noise next to it; the owner moved into
         Sharing below, where it belongs beside who else can see this. -->
    <div class="flex items-baseline justify-between gap-3">
      <span class="shrink-0 text-caption text-muted">Updated</span>
      <span class="min-w-0 truncate text-right text-caption text-secondary">
        {relativeTime(resource.updatedAt)}
      </span>
    </div>

    <!-- Sharing: owner, the control, then who has access — the same shape the
         library's asset details use, so the two read as one idea. Owner is a FACT
         here; changing reach is what Share does. -->
    <section class="space-y-2.5 border-t border-border pt-3">
      <p class="text-label uppercase tracking-wide text-muted">Sharing</p>

      <!-- The hover card carries its own avatar, so there is no icon tile here —
           two faces on one row is one too many. -->
      <div class="rounded-control border border-border bg-work px-2.5 py-2">
        <span class="block text-caption text-muted">Owner</span>
        {#if owner}
          <IdentityHoverCard profile={owner} showAvatar showName portalled class="min-w-0" />
        {:else}
          <span class="block truncate text-body-sm font-medium text-primary">Unknown</span>
        {/if}
      </div>

      {#if canShare}
        <Button variant="primary" size="sm" class="w-full" onclick={() => (shareOpen = true)}>
          <Share2 class="size-3.5" /> Share
        </Button>
      {/if}

      <div class="rounded-control border border-border">
        <p class="border-b border-border px-2.5 py-1.5 text-caption text-muted">
          {restricted ? `Shared with ${sharedPeople.length + sharedOrgs.length}` : 'Everyone in the project'}
        </p>
        {#if restricted}
          {#if sharedPeople.length || sharedOrgs.length}
            <div class="max-h-36 overflow-y-auto p-1">
              {#each sharedOrgs as org (org.id)}
                <div class="flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-work">
                  <span class={cn('flex size-6 shrink-0 items-center justify-center rounded-control', iconTileClass('intel'))}>
                    <Building2 class="size-3.5" />
                  </span>
                  <span class="flex-1 truncate text-caption text-primary">{org.name}</span>
                  <span class="shrink-0 text-caption text-muted">org</span>
                </div>
              {/each}
              {#each sharedPeople as person (person.id)}
                <div class="flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-work">
                  <Avatar name={person.name} size="sm" />
                  <span class="flex-1 truncate text-caption text-primary">{person.name}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="px-2.5 py-2 text-caption text-muted">Only the owner can see this.</p>
          {/if}
        {/if}
      </div>
    </section>

    <section class="border-t border-border pt-3">
      <div class="mb-2 flex items-baseline justify-between gap-2">
        <p class="text-label uppercase tracking-wide text-muted">Recent activity</p>
        {#if events.length >= RESOURCE_EVENT_CAP}
          <span class="shrink-0 text-caption text-muted">latest {RESOURCE_EVENT_CAP}</span>
        {/if}
      </div>
      {#if timelineError}
        <p class="text-caption text-danger">{timelineError}</p>
      {:else if events.length === 0}
        <p class="text-caption text-muted">No activity recorded yet.</p>
      {:else}
        <!-- Rows expand in place to show what that edit changed — the gesture this
             list invites, answered here rather than by navigating away. Only
             documents carry change detail, so only they get the disclosure. -->
        <ActivityList {events} documentId={resource.kind === 'document' ? resource.id : null} />
      {/if}
    </section>
  </div>

  <!-- The editor is ResourceSharing, the same component the resource settings
       dialog renders, so the two surfaces cannot drift. -->
  <Modal bind:open={shareOpen} title="Share “{resource.name}”" size="sm">
    <ResourceSharing {resource} kindLabel={meta.label} />
    {#snippet footer()}
      <Button variant="ghost" onclick={() => (shareOpen = false)}>Done</Button>
    {/snippet}
  </Modal>
{/if}

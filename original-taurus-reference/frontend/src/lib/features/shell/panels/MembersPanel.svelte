<script lang="ts">
  import { Users } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { Avatar, Badge, Button, MockBadge, Modal, PanelResults, Spinner } from '$lib/components';
  import { workspace } from '$data/workspace';
  import {
    projects,
    roster,
    loadRoster,
    byAccess,
    currentUserId,
    type Member
  } from '$data/projects';
  import { projectPresence, isPresent } from '$data/presence';
  import ProjectSharing from '$lib/features/projects/ProjectSharing.svelte';

  /**
   * Project context → Members: who can reach this project, and who is on it.
   *
   * Two groups, in the order the user asked for: **On now**, then **Has access**
   * with the owner first, then editors, then viewers. Membership is real
   * (`GET /projects/:id/members` through the shared `roster` store); presence is
   * mocked and badged, because Omega's presence is keyed by document — see
   * `docs/backend-requests/project-level-presence.md`.
   */
  const project = $derived($projects.find((p) => p.id === $workspace?.projectId) ?? null);
  let manageOpen = $state(false);

  $effect(() => {
    const id = project?.id;
    if (id) void loadRoster(id);
  });

  const ready = $derived($roster.projectId === project?.id);
  const members = $derived(ready ? byAccess($roster.members) : []);
  const me = $derived(currentUserId());

  const presence = $derived($projectPresence.projectId === project?.id ? $projectPresence : null);
  const onNow = $derived(members.filter((m) => presence && isPresent(presence, m.id)));
  const away = $derived(members.filter((m) => !(presence && isPresent(presence, m.id))));

  const roleTone = (role: Member['role']) => (role === 'owner' ? 'action' : role === 'editor' ? 'intel' : 'neutral');
  const roleLabel = (role: Member['role']) => role.charAt(0).toUpperCase() + role.slice(1);
</script>

<!--
  One row shape for both groups. Declared at the top level, not inside
  `<PanelResults>`: a snippet declared as a component's child becomes a PROP of that
  component, which is not what this is.
-->
{#snippet row(m: Member, present: boolean)}
  <li class="flex items-center gap-2 py-1">
    <span class="relative shrink-0">
      <Avatar name={m.name} size="xs" />
      {#if present}
        <span
          class="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-panel bg-success"
          aria-label="On now"
        ></span>
      {/if}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-body-sm text-primary">
        <!-- `&nbsp;` because Svelte trims the leading space inside the span, and
             "Dev(you)" is what that looked like. -->
        {m.name}{#if m.id === me}&nbsp;<span class="text-muted">(you)</span>{/if}
      </span>
      <span class="block truncate text-caption text-muted">{m.email}</span>
    </span>
    <Badge tone={roleTone(m.role)} class="shrink-0">{roleLabel(m.role)}</Badge>
  </li>
{/snippet}

<div class="flex h-full flex-col">
  <div class="shrink-0 space-y-2 pt-1">
    <p class="text-body-sm text-secondary">
      {#if ready}
        {members.length === 1 ? '1 person has access' : `${members.length} people have access`}
      {:else}
        Loading members…
      {/if}
    </p>
    <Button variant="secondary" size="sm" class="w-full" onclick={() => (manageOpen = true)}>
      <Users class="size-4" />
      Manage access
    </Button>
    {#if project?.visibility === 'link'}
      <!-- "Who can reach this" is not only the roster when a link is live. -->
      <p class="text-caption text-attention">
        Link sharing is on — anyone with the link can join.
      </p>
    {/if}
  </div>

  <PanelResults class="mt-3">
    {#if $roster.status === 'loading' && !members.length}
      <div class="flex items-center gap-2 py-2 text-body-sm text-muted">
        <Spinner class="size-4" />
        Loading members…
      </div>
    {:else if $roster.status === 'error'}
      <p class="py-2 text-body-sm text-danger">Couldn’t load members — {$roster.error}</p>
    {/if}

    {#if onNow.length}
      <div class="flex items-center gap-1.5 pb-1">
        <p class="text-label uppercase tracking-wide text-muted">On now</p>
        {#if presence?.mocked}<MockBadge />{/if}
      </div>
      <ul class="mb-2">
        {#each onNow as m (m.id)}{@render row(m, true)}{/each}
      </ul>
      {#if presence?.mocked}
        <p class="mb-3 text-caption text-muted">
          Everyone but you is placeholder presence: Omega tracks presence per document, not per
          project.
        </p>
      {/if}
    {/if}

    {#if away.length}
      <p class={cn('pb-1 text-label uppercase tracking-wide text-muted', onNow.length && 'pt-1')}>
        Has access
      </p>
      <ul>
        {#each away as m (m.id)}{@render row(m, false)}{/each}
      </ul>
    {/if}
  </PanelResults>
</div>

<Modal bind:open={manageOpen} title="Manage access" size="md">
  <div class="space-y-4">
    <p class="text-body-sm text-secondary">
      Roles, invitations, and share links for
      <span class="font-medium text-primary">{project?.name ?? 'this project'}</span>.
    </p>
    <!-- The same component the top-bar Share dialog and Project settings render. -->
    <ProjectSharing projectId={project?.id ?? null} />
  </div>
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        manageOpen = false;
        // The dialog writes membership; the cached roster must not keep serving the
        // list from before those edits.
        if (project?.id) void loadRoster(project.id, true);
      }}
    >
      Done
    </Button>
  {/snippet}
</Modal>

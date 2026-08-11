<script lang="ts">
  import { Settings, Share2 } from '@lucide/svelte';
  import { Button, PanelResults } from '$lib/components';
  import { cn } from '$lib/utils';
  import { workspace } from '$data/workspace';
  import { projects, iconTileClass, roster, loadRoster, ownerOf, currentUserId } from '$data/projects';
  import { resources } from '$data/resources';
  import { kindMeta } from '$lib/features/shared/kinds';
  import { documentEditStamp, relativeTime } from '$data/time';
  import ShareDialog from '../ShareDialog.svelte';
  import ProjectSettingsDialog from '$lib/features/projects/ProjectSettingsDialog.svelte';

  /**
   * Project context → Properties: what this project IS, and the way to the
   * surfaces that change it.
   *
   * The lens is deliberately read-only. Every field here already has an owner —
   * name and icon in Project settings, purpose on the Overview stage, access mode
   * and roles in `ProjectSharing` — so it mounts those components rather than
   * growing a second implementation of them (the drift that made the old mock
   * Share dialog worth deleting).
   */
  const project = $derived($projects.find((p) => p.id === $workspace?.projectId) ?? null);

  let shareOpen = $state(false);
  let settingsOpen = $state(false);

  // The owner's name is the one fact here that isn't already in the projects
  // store (which carries only your own membership). The Members lens reads the
  // same cached roster, so flipping between the two sections costs one request.
  $effect(() => {
    const id = project?.id;
    if (id) void loadRoster(id);
  });
  const owner = $derived($roster.projectId === project?.id ? ownerOf($roster.members) : null);
  const ownerLabel = $derived(
    owner ? (owner.id === currentUserId() ? `${owner.name} (you)` : owner.name) : '—'
  );

  // The same two words `ProjectSharing` uses for the same states — this lens routes
  // into that dialog, and a state that changes its name on the way there reads as a
  // different setting.
  const accessLabel = $derived(project?.visibility === 'link' ? 'Anyone with link' : 'Private');

  // Counted from the loaded catalog rather than a separate call: `enterProjectResources`
  // pages `/resources` to exhaustion, so this total is the real one.
  const counts = $derived.by(() => {
    const byKind = new Map<string, number>();
    for (const r of $resources) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    return [...byKind.entries()]
      .map(([kind, count]) => ({ kind, count, label: kindMeta[kind as keyof typeof kindMeta].label }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });

  const facts = $derived([
    { key: 'Access', value: accessLabel },
    { key: 'Your role', value: project ? project.role.charAt(0).toUpperCase() + project.role.slice(1) : '—' },
    { key: 'Project owner', value: ownerLabel },
    { key: 'Created', value: project?.createdAt ? documentEditStamp(project.createdAt) : '—' },
    { key: 'Last activity', value: project?.updatedAt ? relativeTime(project.updatedAt) : '—' }
  ]);
</script>

<!--
  `flex h-full flex-col` is what makes SidePanel's own scroller inert (see
  PanelResults): the head and the foot stay put, the facts scroll between them.
-->
<div class="flex h-full flex-col">
  <div class="shrink-0 pt-1">
    <div class="flex items-start gap-2.5">
      <span
        class={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control text-label font-semibold',
          iconTileClass(project?.icon ?? 'neutral')
        )}
      >
        {(project?.name ?? '?').charAt(0).toUpperCase()}
      </span>
      <div class="min-w-0">
        <p class="truncate text-body font-medium text-primary">{project?.name ?? 'No project'}</p>
        <p class="text-caption text-muted">
          {$resources.length === 1 ? '1 resource' : `${$resources.length} resources`}
        </p>
      </div>
    </div>

    <p class={cn('mt-3 text-body-sm', project?.purpose ? 'text-secondary' : 'text-muted')}>
      {project?.purpose || 'No purpose set — write one on the project’s overview.'}
    </p>
  </div>

  <PanelResults class="mt-4">
    <dl class="divide-y divide-border border-y border-border">
      {#each facts as fact (fact.key)}
        <div class="flex items-baseline justify-between gap-3 py-2">
          <dt class="shrink-0 text-caption text-muted">{fact.key}</dt>
          <dd class="min-w-0 truncate text-right text-body-sm text-primary">{fact.value}</dd>
        </div>
      {/each}
    </dl>

    {#if counts.length}
      <p class="mt-4 text-label uppercase tracking-wide text-muted">Contents</p>
      <ul class="mt-1.5 space-y-1">
        {#each counts as entry (entry.kind)}
          {@const meta = kindMeta[entry.kind as keyof typeof kindMeta]}
          {@const Icon = meta.icon}
          <li class="flex items-center gap-2 text-body-sm text-secondary">
            <span class={cn('flex size-5 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
              <Icon class="size-3" />
            </span>
            <span class="min-w-0 truncate">{entry.label}{entry.count === 1 ? '' : 's'}</span>
            <span class="ml-auto tabular-nums text-caption text-muted">{entry.count}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </PanelResults>

  <div class="mt-3 flex shrink-0 items-center gap-1.5 border-t border-border pt-3">
    <Button variant="secondary" size="sm" class="flex-1" onclick={() => (shareOpen = true)}>
      <Share2 class="size-4" />
      Share
    </Button>
    <Button variant="ghost" size="sm" class="flex-1" onclick={() => (settingsOpen = true)}>
      <Settings class="size-4" />
      Settings
    </Button>
  </div>
</div>

<ShareDialog bind:open={shareOpen} projectId={project?.id ?? null} projectName={project?.name ?? 'this project'} />
<ProjectSettingsDialog bind:open={settingsOpen} projectId={project?.id ?? null} />

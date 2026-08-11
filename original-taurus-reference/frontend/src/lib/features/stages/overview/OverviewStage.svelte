<script lang="ts">
  import { SlidersHorizontal } from '@lucide/svelte';
  import { openTab } from '$data/workspace';
  import { getResourceMetadata, type ActivityEvent, type ActivityTarget } from '$data/projects';
  import { isApiError } from '$data/api';
  import { activeSurface } from '$lib/features/shared/surface';
  import { toast } from '$lib/components';
  import {
    enterProjectResources,
    addResource,
    removeResource,
    renameResource,
    canCreate,
    type Resource,
    type ResourceKind
  } from '$data/resources';
  import { kindMeta } from '$lib/features/shared/kinds';
  import PurposeStatement from './PurposeStatement.svelte';
  import CreateColumn from './CreateColumn.svelte';
  import ActivityFeed from './ActivityFeed.svelte';
  import ResourceTable from '$lib/features/stages/shared/ResourceTable.svelte';
  import OverviewDetailsPanel from './lenses/OverviewDetailsPanel.svelte';
  import {
    overviewSelection,
    overviewProjectId,
    inspectResource,
    inspectResources,
    inspectActivity,
    clearOverviewSelection
  } from './overview-session';

  let { projectId, projectName }: { projectId: string; projectName: string } = $props();

  $effect(() => {
    enterProjectResources(projectId);
  });

  /**
   * Overview contributes ONLY an inspector section. Leaving `context` undefined
   * is deliberate — `contextSectionsFor` falls back to the project-context set,
   * which is exactly what this stage wants in the left rail.
   */
  $effect(() => {
    overviewProjectId.set(projectId);
    clearOverviewSelection();
    activeSurface.set({
      id: `overview:${projectId}`,
      scope: projectName,
      inspector: [
        { id: 'details', label: 'Details', icon: SlidersHorizontal, content: OverviewDetailsPanel }
      ]
    });
    return () => {
      activeSurface.set(null);
      clearOverviewSelection();
    };
  });

  // What the two surfaces draw as inspected. Each reads only its own mode, so a
  // resource selection never marks an activity row and vice versa.
  const inspectedResourceId = $derived(
    $overviewSelection.mode === 'resource' ? $overviewSelection.resourceId : null
  );
  const inspectedActivityId = $derived(
    $overviewSelection.mode === 'activity' ? $overviewSelection.event.id : null
  );

  async function create(kind: ResourceKind) {
    if (!canCreate(kind)) {
      toast(`${kindMeta[kind].label} resources aren't available yet.`, { tone: 'attention' });
      return;
    }
    const name = `Untitled ${kindMeta[kind].label.toLowerCase()}`;
    try {
      const r = await addResource(projectId, name, kind);
      openTab(r.name, r.id, r.kind);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not create the resource.', { tone: 'danger' });
    }
  }
  function openResource(r: Resource) {
    openTab(r.name, r.id, r.kind);
  }
  function fail(action: string) {
    return (e: unknown) => toast(isApiError(e) ? e.message : `Could not ${action} the resource.`, { tone: 'danger' });
  }
  async function openActivityTarget(target: ActivityTarget) {
    try {
      const resource = await getResourceMetadata(target.kind, target.id);
      openTab(resource.name, resource.id, resource.kind);
    } catch {
      toast('This resource is no longer available.', { tone: 'attention' });
    }
  }
</script>

<!--
  Overview = the project's home. The stage frame never scrolls; the activity feed and
  the table body scroll within their own regions. pb-20 reserves room for the floating
  Quarterback dock so the table clears it.
-->
<div class="mx-auto flex h-full max-w-4xl flex-col px-8 pt-6 pb-20">
  <!-- Project identity + full-width purpose -->
  <header class="shrink-0">
    <h1 class="text-center text-h2 font-semibold">{projectName}</h1>
    <div class="mt-3">
      <PurposeStatement {projectId} />
    </div>
  </header>

  <!-- Create + Activity: two equal-height bordered panels, moved down a little; activity fills the width -->
  <div class="mt-8 grid h-56 shrink-0 grid-cols-1 grid-rows-2 gap-6 sm:grid-cols-[15rem_minmax(0,1fr)] sm:grid-rows-1">
    <CreateColumn {kindMeta} oncreate={create} />
    <ActivityFeed
      {projectId}
      onopen={openActivityTarget}
      inspectedId={inspectedActivityId}
      oninspect={(event: ActivityEvent, redacted: boolean) => inspectActivity(event, redacted)}
    />
  </div>

  <!-- All resources (eyebrow header matching Create/Activity); kept as a table -->
  <section class="mt-3 flex min-h-0 flex-1 flex-col">
    <p class="mb-2 shrink-0 text-label uppercase tracking-wide text-muted">All resources</p>
    <ResourceTable
      {kindMeta}
      onopen={openResource}
      onremove={(r) => void removeResource(projectId, r.id).catch(fail('delete'))}
      onimport={() => toast("Importing files isn't available yet.", { tone: 'attention' })}
      onrename={(id, name) => void renameResource(projectId, id, name).catch(fail('rename'))}
      inspectedId={inspectedResourceId}
      oninspect={(r: Resource) => inspectResource(r.id)}
      onselectionchange={inspectResources}
    />
  </section>
</div>

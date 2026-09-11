<script lang="ts">
  import { ResourceTable } from "$authored-components/resource-table";
  import { launchResource } from "$app-views/categories/new-tab/procedures/launch-resource";
  import { inspectResource } from "$app-views/categories/new-tab/procedures/inspect-resource";
  import { resourcesOf, type LauncherResource } from "$app-views/categories/new-tab/procedures/resources";
  import { KIND_LABEL, KIND_PLURAL } from "$app-views/shared/project-resources/procedures/kind-labels";
  import { readResources } from "$app-views/shared/project-resources/procedures/read-resources";
  import { workspaceState } from "$model/client/workspace-state";

  let {
    now,
    onopen
  }: {
    now: number;
    onopen?: (row: LauncherResource) => void;
  } = $props();

  const view = workspaceState();
  const resourceIndex = readResources();
  const work = $derived(resourcesOf(resourceIndex.ready ? resourceIndex.current : undefined, now));

  const inspect = (id: string): void => {
    const row = work.find((row) => row.id === id);
    if (row) inspectResource(view, row);
  };

  const launch = (id: string): void => {
    const row = work.find((row) => row.id === id);
    if (!row) return;
    if (onopen) onopen(row);
    else launchResource(view, row);
  };
</script>

<ResourceTable
  showCount={false}
  resources={work}
  kindLabels={KIND_LABEL}
  kindPlurals={KIND_PLURAL}
  ready={resourceIndex.ready}
  failed={Boolean(resourceIndex.error)}
  unavailable={resourceIndex.ready ? resourceIndex.current.unavailable.length : 0}
  selectedId={view.selection?.id}
  onretry={() => resourceIndex.refresh()}
  onselect={inspect}
  onopen={launch}
/>

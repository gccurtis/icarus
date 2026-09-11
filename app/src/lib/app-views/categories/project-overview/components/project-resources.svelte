<script lang="ts">
  import { ResourceTable } from "$authored-components/resource-table";
  import { inspectionFor } from "$app-views/categories/project-overview/procedures/inspecting";
  import { openResource } from "$app-views/categories/project-overview/procedures/open-resource";
  import { resourcesIn } from "$app-views/categories/project-overview/procedures/resources";
  import { KIND_LABEL, KIND_PLURAL } from "$app-views/shared/project-resources/procedures/kind-labels";
  import { readResources } from "$app-views/shared/project-resources/procedures/read-resources";
  import { workspaceState } from "$model/client/workspace-state";

  let { now }: { now: number } = $props();

  const view = workspaceState();
  const resourceIndex = readResources();
  const work = $derived(resourcesIn(resourceIndex.ready ? resourceIndex.current : undefined, now));

  const inspect = (id: string): void => {
    const row = work.find((row) => row.id === id);
    if (!row) return;
    const { key, selection } = inspectionFor(row);
    view.inspect(key, selection);
  };

  const launch = (id: string): void => {
    const row = work.find((row) => row.id === id);
    if (row) openResource(view, row);
  };
</script>

<ResourceTable
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

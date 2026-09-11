<script lang="ts">
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import Table2 from "@lucide/svelte/icons/table-2";

  import { ToggleGroup, ToggleGroupItem } from "$vendored-components/toggle-group";
  import { externalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import { setLibraryMode } from "$app-views/categories/external/procedures/set-library-mode";

  const { state } = externalLibraryContext();
</script>

<div class="view-switcher">
  <ToggleGroup type="single" variant="outline" size="sm" aria-label="Library view"
    bind:value={() => state.mode, (next: string) => {
      if (next === "table" || next === "directory") setLibraryMode(state, next);
    }}>
    <ToggleGroupItem value="table" aria-label="Table">
      <Table2 aria-hidden="true" /> Table
    </ToggleGroupItem>
    <ToggleGroupItem value="directory" aria-label="Directory">
      <FolderTree aria-hidden="true" /> Directory
    </ToggleGroupItem>
  </ToggleGroup>
</div>

<style>
  .view-switcher { display: flex; align-items: center; }
</style>

<script lang="ts">
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import Table2 from "@lucide/svelte/icons/table-2";

  import { Button } from "$vendored-components/button";
  import { externalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import { setLibraryMode } from "$app-views/categories/external/procedures/set-library-mode";

  const { state } = externalLibraryContext();
</script>

<div class="library-lead">
  <p>Native project files live here as one managed library. Select a file or virtual directory to manage it in the Inspector; External never opens a file-type editor.</p>
  <div class="view-switcher" role="group" aria-label="Library view">
    <Button variant={state.mode === "table" ? "secondary" : "ghost"} size="sm"
      aria-pressed={state.mode === "table"} onclick={() => setLibraryMode(state, "table")}>
      <Table2 aria-hidden="true" /> Table
    </Button>
    <Button variant={state.mode === "directory" ? "secondary" : "ghost"} size="sm"
      aria-pressed={state.mode === "directory"} onclick={() => setLibraryMode(state, "directory")}>
      <FolderTree aria-hidden="true" /> Directory
    </Button>
  </div>
</div>

<style>
  .library-lead { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 4); }
  .library-lead p { max-width: 54rem; margin: 0; color: var(--token-ink-muted); font-size: var(--token-text-body-sm); line-height: var(--token-text-body-sm-leading); }
  .view-switcher { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: calc(var(--token-spacing-unit) * 2); }
  @media (max-width: 58rem) { .library-lead { align-items: flex-start; flex-direction: column; } }
</style>

<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  import {
    ScreenEmpty,
    ScreenGroup,
    ScreenHeader,
    ScreenNote,
    ScreenSurface
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import DirectoryTable from "$app-views/categories/external/components/directory-table.svelte";
  import FileTable from "$app-views/categories/external/components/file-table.svelte";
  import LibraryControls from "$app-views/categories/external/components/library-controls.svelte";
  import LibraryFilters from "$app-views/categories/external/components/library-filters.svelte";
  import Uploads from "$app-views/categories/external/components/uploads.svelte";
  import { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
  import { keepExternalLibraryCurrent } from "$app-views/categories/external/procedures/effects/library.svelte";
  import {
    externalDirectoriesIn,
    externalFilesIn
  } from "$app-views/categories/external/procedures/library-query";
  import { externalFileLibrary } from "$app-views/categories/external/procedures/read-library";
  import { provideExternalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import {
    directExternalDirectories,
    externalAuthors,
    libraryBreadcrumbs,
    libraryFiltersActive,
    visibleExternalFiles
  } from "$app-views/categories/external/procedures/library-view";
  import { clearLibraryFilters } from "$app-views/categories/external/procedures/clear-library-filters";
  import { setLibraryDirectory } from "$app-views/categories/external/procedures/set-library-directory";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const state = new ExternalLibraryState();
  const library = externalFileLibrary();
  const answer = $derived(library.ready ? library.current : undefined);
  const files = $derived(externalFilesIn(answer, state.now));
  const authors = $derived(externalAuthors(files, state.author));
  const directories = $derived(externalDirectoriesIn(answer));
  const visibleFiles = $derived(visibleExternalFiles(state, files));
  const directDirectories = $derived(directExternalDirectories(state, directories));
  const current = $derived(directories.find((row) => row.relativePath === state.currentDirectory));
  const crumbs = $derived(libraryBreadcrumbs(state.currentDirectory));
  const filtersActive = $derived(libraryFiltersActive(state));
  const uploadResult = $derived(state.latestUploadResult);

  provideExternalLibraryContext({
    state,
    view,
    authors: () => authors,
    visibleFiles: () => visibleFiles,
    directDirectories: () => directDirectories
  });

  keepExternalLibraryCurrent(state, view, {
    ready: () => library.ready,
    files: () => files,
    directories: () => directories
  });
</script>

<ScreenSurface>
  <div class="library-stack">
    <ScreenHeader title="External Files">
      {#snippet actions()}<Uploads />{/snippet}
    </ScreenHeader>
    <LibraryControls />

    {#if uploadResult}
      <ScreenNote tone={uploadResult.rejected > 0 ? "gap" : "muted"}>
        {uploadResult.uploaded} uploaded · {uploadResult.reused} already present · {uploadResult.rejected} rejected.
        {#each uploadResult.outcomes.filter((outcome) => outcome.status === "rejected") as outcome}
          <span class="receipt-error">{outcome.name}: {outcome.detail}</span>
        {/each}
      </ScreenNote>
    {/if}
    {#if state.folderPathError !== undefined}
      <ScreenNote tone="gap">{state.folderPathError}</ScreenNote>
    {/if}

    {#if library.error}
      <div class="remote-state">
        <ScreenEmpty title="The External Files library could not be loaded">
          {library.error instanceof Error ? library.error.message : String(library.error)}
        </ScreenEmpty>
        <Button variant="outline" size="sm" onclick={() => library.refresh()}>Retry library</Button>
      </div>
    {:else if !library.ready}
      <ScreenEmpty title="Loading External Files">Reading project-owned file metadata.</ScreenEmpty>
    {:else}
      <ScreenGroup label={state.mode === "table" ? "All files" : (current?.name ?? "External Files")}
        count={String(state.mode === "table" ? files.length : (current?.descendantFileCount ?? files.length))}>
        <div class="table-stack">
          <LibraryFilters />
          {#if state.mode === "directory"}
            <nav class="breadcrumbs" aria-label="External Files directory">
              {#each crumbs as crumb, index (crumb.path)}
                {#if index > 0}<ChevronRight size={12} aria-hidden="true" />{/if}
                <button type="button" aria-current={crumb.path === state.currentDirectory ? "page" : undefined}
                  onclick={() => setLibraryDirectory(state, crumb.path)}>{crumb.label}</button>
              {/each}
            </nav>
          {/if}
          {#if visibleFiles.length === 0 && (state.mode === "table" || directDirectories.length === 0)}
            <ScreenEmpty kind={filtersActive ? "no-matches" : "nothing-yet"}
              title={filtersActive ? "No file matches" : "No external files yet"}
              onclear={filtersActive ? () => clearLibraryFilters(state) : undefined}>
              {filtersActive ? "Try another name, author, kind, or semantic state." : "Choose files or a folder above. Unsupported formats remain safely stored and downloadable."}
            </ScreenEmpty>
          {:else if state.mode === "table"}
            <FileTable />
          {:else}
            <DirectoryTable />
          {/if}
        </div>
      </ScreenGroup>
    {/if}
  </div>
</ScreenSurface>

<style>
  .library-stack, .table-stack, .remote-state { display: flex; min-width: 0; flex-direction: column; gap: calc(var(--token-spacing-unit) * 3); }
  .library-stack { gap: calc(var(--token-spacing-unit) * 5); }
  .breadcrumbs { display: flex; min-height: calc(var(--token-spacing-unit) * 8); align-items: center; gap: calc(var(--token-spacing-unit) * 1); padding-inline: calc(var(--token-spacing-unit) * 1); color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  .breadcrumbs button { color: var(--token-ink-muted); }
  .breadcrumbs button[aria-current="page"] { color: var(--token-ink-primary); font-weight: 600; }
  .breadcrumbs button:hover { text-decoration: underline; }
  .receipt-error { display: block; margin-top: calc(var(--token-spacing-unit) * 1); }
</style>

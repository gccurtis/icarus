<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import Search from "@lucide/svelte/icons/search";
  import Table2 from "@lucide/svelte/icons/table-2";
  import Upload from "@lucide/svelte/icons/upload";

  import { selectMockDirectory } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/select-directory";
  import { selectMockFile } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/select-file";
  import { setMockLibraryFilter } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/set-library-filter";
  import { setMockLibraryView } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/set-library-view";
  import { stableTabMockState } from "$development-views/external-files-reference/procedures/stable-tab-mock/context.svelte";
  import type { MockSemanticFilter } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
  import {
    mockDirectories,
    mockFileName,
    mockFilePath,
    selectedMockFile,
    visibleMockFiles
  } from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

  const state = stableTabMockState();
  const visible = $derived(visibleMockFiles(state));
  const directories = $derived(mockDirectories(state));
  const selected = $derived(selectedMockFile(state));
</script>

<main class="content-panel" aria-label="Mock External library Content surface">
  <header class="library-header">
    <div>
      <span>EXTERNAL LIBRARY</span>
      <h3>External</h3>
      <p>Manage project files that do not have dedicated editors.</p>
    </div>
    <div class="upload-actions">
      <button type="button"><Upload size={13} aria-hidden="true" /> Upload files</button>
      <button type="button"><FolderUp size={13} aria-hidden="true" /> Upload folder</button>
    </div>
  </header>

  <div class="view-switch" role="group" aria-label="Library view">
    <button
      type="button"
      class:active={state.libraryView === "table"}
      aria-pressed={state.libraryView === "table"}
      onclick={() => setMockLibraryView(state, "table")}
    ><Table2 size={12} aria-hidden="true" /> Table</button>
    <button
      type="button"
      class:active={state.libraryView === "directory"}
      aria-pressed={state.libraryView === "directory"}
      onclick={() => setMockLibraryView(state, "directory")}
    ><FolderTree size={12} aria-hidden="true" /> Directory</button>
  </div>

  <div class="library-tools">
    <label>
      <Search size={13} aria-hidden="true" />
      <span class="sr-only">Search files</span>
      <input
        value={state.query}
        oninput={(event) => setMockLibraryFilter(state, {
          kind: "query",
          value: event.currentTarget.value
        })}
        placeholder="Search files and paths"
      />
    </label>
    <select
      value={state.semanticFilter}
      onchange={(event) => setMockLibraryFilter(state, {
        kind: "semantic",
        value: event.currentTarget.value as MockSemanticFilter
      })}
      aria-label="Meaning status"
    >
      <option value="all">All meaning states</option>
      <option value="current">Current</option>
      <option value="queued">In progress</option>
      <option value="limited">Managed only</option>
    </select>
    <span>{visible.length} files</span>
  </div>

  {#if state.notice}<div class="notice" role="status">{state.notice}</div>{/if}

  <div class="resource-table-wrap">
    {#if state.libraryView === "directory"}
      <div class="breadcrumbs"><strong>External</strong><span>/</span><span>Root</span></div>
      <table class="resource-table directory-table">
        <thead><tr><th>Name</th><th>Type</th><th>Contents</th><th>Location</th></tr></thead>
        <tbody>
          {#each directories as directory}
            <tr class:selected={state.selectedDirectory === directory.path}>
              <td>
                <button
                  type="button"
                  aria-label={`Inspect ${directory.path} folder`}
                  onclick={() => selectMockDirectory(state, directory.path)}
                ><Folder size={14} aria-hidden="true" /><span>{directory.path}</span></button>
              </td>
              <td>Folder</td><td>{directory.files} descendant files</td><td>External/{directory.path}</td>
            </tr>
          {/each}
          {#each visible.filter((file) => !mockFilePath(state, file).includes("/")) as file (file.id)}
            <tr>
              <td><button type="button" onclick={() => selectMockFile(state, file.id)}>{mockFileName(state, file)}</button></td>
              <td>{file.type}</td><td>File</td><td>External</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if visible.length === 0}
      <div class="empty"><strong>No file matches.</strong><span>Clear search or meaning filters.</span></div>
    {:else}
      <table class="resource-table">
        <thead><tr><th>Name</th><th>Type</th><th>Path</th><th>Meaning</th><th>Size</th><th>Updated</th></tr></thead>
        <tbody>
          {#each visible as file (file.id)}
            {@const FileIcon = file.icon}
            <tr class:selected={selected?.id === file.id && state.selectedDirectory === undefined}>
              <td>
                <button
                  type="button"
                  aria-label={`Inspect ${mockFileName(state, file)}`}
                  onclick={() => selectMockFile(state, file.id)}
                ><FileIcon size={14} strokeWidth={1.8} aria-hidden="true" /><span>{mockFileName(state, file)}</span></button>
              </td>
              <td>{file.type}</td><td><span class="path">{mockFilePath(state, file)}</span></td>
              <td><span class="semantic-badge {file.semanticTone}">{file.semantic}</span></td>
              <td class="number">{file.size}</td><td class="number">{file.updated}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
  <footer class="library-foot">
    <span>Single click selects · double click opens a folder</span>
    <span>No file opens an editor tab</span>
  </footer>
</main>

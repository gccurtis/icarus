<script lang="ts">
  import File from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderCog from "@lucide/svelte/icons/folder-cog";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";

  import { Panel, PanelBanner, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
  import { keepExternalDirectoryInspectorCurrent } from "$app-views/categories/external/procedures/effects/directory-inspector.svelte";
  import { directoryInspector } from "$app-views/categories/external/procedures/directory-inspector/directory-inspector";
  import {
    externalDirectoriesIn,
    externalFileLibrary,
    externalFilesIn,
    inspectExternalDirectory,
    inspectExternalFile,
  } from "$app-views/categories/external/procedures";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const state = new ExternalDirectoryInspectorState();
  const library = externalFileLibrary();
  const directories = $derived(externalDirectoriesIn(library.ready ? library.current : undefined));
  const files = $derived(externalFilesIn(library.ready ? library.current : undefined, Date.now()));
  const selectedPath = $derived(view.selection?.kind === "external-directory" ? view.selection.id : undefined);
  const directory = $derived(directories.find((row) => row.relativePath === selectedPath));
  const children = $derived(directory === undefined ? [] : directories.filter((row) => row.parentPath === directory.relativePath));
  const childFiles = $derived(directory === undefined ? [] : files.filter((row) => {
    const split = row.relativePath.lastIndexOf("/");
    return (split < 0 ? "" : row.relativePath.slice(0, split)) === directory.relativePath;
  }));
  keepExternalDirectoryInspectorCurrent(state, () => directory);
</script>

{#snippet heading()}<span class="panel-heading"><FolderCog size={14} aria-hidden="true" /> Directory</span>{/snippet}

<Panel title={directory?.name ?? "Directory"} heading={heading}>
  {#if library.error}
    <PanelBanner title="Directory unavailable" tone="danger">{library.error instanceof Error ? library.error.message : String(library.error)}</PanelBanner>
  {:else if !library.ready}
    <PanelSkeleton shape="fields" count={7} />
  {:else if directory === undefined || directory.relativePath === ""}
    <PanelEmpty title="Select a directory to manage it." />
  {:else}
    <div class="stack">
      <div class="toolbar" role="toolbar" aria-label="Directory actions">
        <Button variant="ghost" size="sm" disabled={state.pending} onclick={() => directoryInspector.start(state, "rename", directory)}><Pencil aria-hidden="true" /> Rename</Button>
        <Button variant="ghost" size="sm" disabled={state.pending} onclick={() => directoryInspector.start(state, "move", directory)}><FolderInput aria-hidden="true" /> Move</Button>
      </div>
      {#if state.actionError}<PanelBanner title="The directory did not change" tone="attention">{state.actionError}</PanelBanner>{/if}

      <section>
        <h3>Directory</h3>
        {#if state.editing}
          <div class="inline-editor">
            <Input bind:ref={state.input} bind:value={state.draft} aria-label={state.editing === "rename" ? "Directory name" : "Directory path"} maxlength={512} disabled={state.pending} onkeydown={(event) => directoryInspector.keydown(state, event, view, directory)} />
            <Button size="sm" disabled={state.pending || state.draft.trim() === ""} onclick={() => directoryInspector.commit(state, view, directory)}>{state.pending ? "Moving…" : (state.editing === "rename" ? "Rename" : "Move")}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel directory change" onclick={() => directoryInspector.cancel(state, directory)}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-name" title="Double-click to rename" ondblclick={() => directoryInspector.start(state, "rename", directory)}><span>{directory.name}</span><Pencil size={12} aria-hidden="true" /></button>
          <p class="path">{directory.relativePath}</p>
        {/if}
      </section>

      <div class="divider" aria-hidden="true"></div>
      <section>
        <h3>Contents</h3>
        <dl>
          <dt>Files here</dt><dd>{directory.directFileCount}</dd>
          <dt>Subdirectories</dt><dd>{directory.directDirectoryCount}</dd>
          <dt>All files below</dt><dd>{directory.descendantFileCount}</dd>
          <dt>Known size</dt><dd>{directory.sizeLabel}</dd>
        </dl>
        {#if children.length === 0 && childFiles.length === 0}
          <p class="empty">This virtual directory is empty.</p>
        {:else}
          <ul class="children">
            {#each children as child (child.relativePath)}
              <li><button type="button" onclick={() => inspectExternalDirectory(view, child.relativePath)}><Folder size={13} aria-hidden="true" /><span>{child.name}</span><small>{child.descendantFileCount}</small></button></li>
            {/each}
            {#each childFiles as file (file.id)}
              <li><button type="button" onclick={() => inspectExternalFile(view, file.id)}><File size={13} aria-hidden="true" /><span>{file.name}</span><small>{file.sizeLabel}</small></button></li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</Panel>

<style>
  .panel-heading, .toolbar, .inline-editor, .editable-name, .children button { display: flex; align-items: center; }
  .panel-heading { gap: calc(var(--token-spacing-unit) * 1.5); }
  .stack { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 3); padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 5); }
  .toolbar { gap: calc(var(--token-spacing-unit) * 1); padding-bottom: calc(var(--token-spacing-unit) * 2); border-bottom: 1px solid var(--token-border-subtle); }
  h3, p, dl, ul { margin: 0; }
  h3 { color: var(--token-ink-muted); font-size: var(--token-text-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .inline-editor { gap: calc(var(--token-spacing-unit) * 1); margin-top: calc(var(--token-spacing-unit) * 2); }
  .editable-name { width: 100%; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); margin-top: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-primary); font-size: var(--token-text-body-sm); font-weight: 600; text-align: start; }
  .editable-name :global(svg) { flex: none; opacity: 0; }
  .editable-name:hover :global(svg), .editable-name:focus-visible :global(svg) { opacity: 1; }
  .path, .empty { color: var(--token-ink-muted); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  .path { margin-top: calc(var(--token-spacing-unit) * 1); font-family: var(--token-font-mono); }
  .divider { border-top: 1px solid var(--token-border-subtle); }
  dl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2); margin-top: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  dt, dd { margin: 0; } dd { color: var(--token-ink-secondary); font-variant-numeric: tabular-nums; }
  .children { display: flex; flex-direction: column; margin-top: calc(var(--token-spacing-unit) * 2); padding: 0; list-style: none; }
  .children button { width: 100%; gap: calc(var(--token-spacing-unit) * 1.5); padding-block: calc(var(--token-spacing-unit) * 1.5); border-bottom: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); font-size: var(--token-text-caption); text-align: start; }
  .children button:hover span { text-decoration: underline; }
  .children span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .children small { flex: none; color: var(--token-ink-muted); }
  .empty { margin-top: calc(var(--token-spacing-unit) * 2); }
</style>

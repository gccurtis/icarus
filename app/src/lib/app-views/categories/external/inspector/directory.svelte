<script lang="ts">
  import { tick } from "svelte";
  import File from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderCog from "@lucide/svelte/icons/folder-cog";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";

  import { Panel, PanelBanner, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import {
    externalDirectoriesIn,
    externalFileLibrary,
    externalFilesIn,
    inspectExternalDirectory,
    inspectExternalFile,
    relocateExternalDirectory,
    type LibraryExternalDirectory
  } from "$app-views/categories/external/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = externalFileLibrary();
  const directories = $derived(externalDirectoriesIn(library.ready ? library.current : undefined));
  const files = $derived(externalFilesIn(library.ready ? library.current : undefined, Date.now()));
  const selectedPath = $derived(view.selection?.kind === "external-directory" ? view.selection.id : undefined);
  const directory = $derived(directories.find((row) => row.path === selectedPath));
  const children = $derived(directory === undefined ? [] : directories.filter((row) => row.parentPath === directory.path));
  const childFiles = $derived(directory === undefined ? [] : files.filter((row) => {
    const split = row.relativePath.lastIndexOf("/");
    return (split < 0 ? "" : row.relativePath.slice(0, split)) === directory.path;
  }));

  let editing = $state<"rename" | "move">();
  let draft = $state("");
  let input = $state<HTMLInputElement | null>(null);
  let base = $state<LibraryExternalDirectory>();
  let pending = $state(false);
  let actionError = $state<string>();

  $effect(() => {
    if (base?.path === directory?.path) return;
    base = undefined;
    editing = undefined;
    draft = directory?.path ?? "";
    actionError = undefined;
  });

  const start = async (kind: "rename" | "move") => {
    if (directory === undefined || pending) return;
    base = directory;
    editing = kind;
    draft = kind === "rename" ? directory.name : directory.path;
    await tick();
    input?.focus();
    input?.select();
  };

  const cancel = () => {
    base = undefined;
    editing = undefined;
    draft = directory?.path ?? "";
  };

  const destinationFor = (held: LibraryExternalDirectory): string => {
    const value = draft.trim();
    if (editing === "move") return value;
    return held.parentPath === "" || held.parentPath === null
      ? value
      : `${held.parentPath}/${value}`;
  };

  const commit = async () => {
    const held = base;
    if (held === undefined || editing === undefined || pending) return;
    const destination = destinationFor(held);
    if (destination === "") return void (actionError = "A directory name or path is required.");
    if (destination === held.path) return cancel();
    pending = true;
    actionError = undefined;
    try {
      const result = await relocateExternalDirectory(view, held, destination);
      if (!result.accepted) actionError = result.detail;
      else {
        cancel();
        inspectExternalDirectory(view, result.destination);
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally { pending = false; }
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  };
</script>

{#snippet heading()}<span class="panel-heading"><FolderCog size={14} aria-hidden="true" /> Directory</span>{/snippet}

<Panel title={directory?.name ?? "Directory"} heading={heading}>
  {#if library.error}
    <PanelBanner title="Directory unavailable" tone="danger">{library.error instanceof Error ? library.error.message : String(library.error)}</PanelBanner>
  {:else if !library.ready}
    <PanelSkeleton shape="fields" count={7} />
  {:else if directory === undefined || directory.path === ""}
    <PanelEmpty title="Select a directory to manage it." />
  {:else}
    <div class="stack">
      <div class="toolbar" role="toolbar" aria-label="Directory actions">
        <Button variant="ghost" size="sm" disabled={pending} onclick={() => start("rename")}><Pencil aria-hidden="true" /> Rename</Button>
        <Button variant="ghost" size="sm" disabled={pending} onclick={() => start("move")}><FolderInput aria-hidden="true" /> Move</Button>
      </div>
      {#if actionError}<PanelBanner title="The directory did not change" tone="attention">{actionError}</PanelBanner>{/if}

      <section>
        <h3>Directory</h3>
        {#if editing}
          <div class="inline-editor">
            <Input bind:ref={input} bind:value={draft} aria-label={editing === "rename" ? "Directory name" : "Directory path"} maxlength={512} disabled={pending} onkeydown={keydown} />
            <Button size="sm" disabled={pending || draft.trim() === ""} onclick={commit}>{pending ? "Moving…" : (editing === "rename" ? "Rename" : "Move")}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel directory change" onclick={cancel}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-name" title="Double-click to rename" ondblclick={() => start("rename")}><span>{directory.name}</span><Pencil size={12} aria-hidden="true" /></button>
          <p class="path">{directory.path}</p>
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
            {#each children as child (child.path)}
              <li><button type="button" onclick={() => inspectExternalDirectory(view, child.path)}><Folder size={13} aria-hidden="true" /><span>{child.name}</span><small>{child.descendantFileCount}</small></button></li>
            {/each}
            {#each childFiles as file (file.id)}
              <li><button type="button" onclick={() => inspectExternalFile(view, file.id)}><File size={13} aria-hidden="true" /><span>{file.name}</span><small>{file.sizeLabel}</small></button></li>
            {/each}
          </ul>
        {/if}
      </section>
      <p class="note">Directories are a view over file paths. Renaming or moving one atomically rewrites every descendant file path; no native server directory is created.</p>
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
  .path, .empty, .note { color: var(--token-ink-muted); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
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
  .note { padding: calc(var(--token-spacing-unit) * 2); border: 1px dashed var(--token-border-subtle); border-radius: var(--token-radius-control); }
</style>

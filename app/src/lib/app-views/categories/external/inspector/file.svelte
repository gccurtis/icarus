<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import FileCog from "@lucide/svelte/icons/file-cog";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import Pencil from "@lucide/svelte/icons/pencil";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  import { Panel, PanelBanner, PanelChip, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import FileDetails from "$app-views/categories/external/components/file-details.svelte";
  import FileReferences from "$app-views/categories/external/components/file-references.svelte";
  import FileSemanticStatus from "$app-views/categories/external/components/file-semantic-status.svelte";
  import { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
  import { keepExternalFileInspectorCurrent } from "$app-views/categories/external/procedures/effects/file-inspector.svelte";
  import { fileInspector } from "$app-views/categories/external/procedures/file-inspector/file-inspector";
  import { provideExternalFileInspectorContext } from "$app-views/categories/external/procedures/file-inspector-context.svelte";
  import {
    detailIn,
    externalFileDetail,
    externalFileDownloadHref,
    externalFileLibrary,
    externalFileReupload,
    selectedExternalFileIdIn,
    unavailableIn
  } from "$app-views/categories/external/procedures";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const state = new ExternalFileInspectorState();
  const library = externalFileLibrary();
  const selectedId = $derived(view.selection?.kind === "external-file" ? view.selection.id : undefined);
  const availableIds = $derived(library.ready ? library.current.files.map((item) => item.id) : []);
  const readableId = $derived(selectedExternalFileIdIn(selectedId, availableIds));
  const detail = $derived(externalFileDetail(readableId));
  const answer = $derived(detail !== undefined && detail.ready ? detail.current : undefined);
  const unavailable = $derived(unavailableIn(answer));
  const file = $derived(detailIn(answer, state.now));
  const reupload = externalFileReupload.for("reupload");
  const busy = $derived(fileInspector.isBusy(state, reupload.pending));

  provideExternalFileInspectorContext({ file: () => file! });
  keepExternalFileInspectorCurrent(state, {
    file: () => file,
    reuploadResult: () => reupload.result
  });
</script>

{#snippet heading()}<span class="panel-heading"><FileCog size={14} aria-hidden="true" /> File</span>{/snippet}

<Panel title={file?.name ?? "File"} heading={heading}>
  {#if !library.ready}
    <PanelSkeleton shape="fields" count={7} />
  {:else if readableId === undefined}
    <PanelEmpty title={library.current.files.length === 0 ? "No files exist." : "Select a file to manage it."} />
  {:else if detail === undefined}
    <PanelEmpty title="Select a file to manage it." />
  {:else if detail.error}
    <PanelBanner title="File unavailable" tone="danger">{detail.error instanceof Error ? detail.error.message : String(detail.error)}</PanelBanner>
  {:else if !detail.ready}
    <PanelSkeleton shape="fields" count={9} />
  {:else if unavailable}
    <PanelBanner title="File metadata unavailable" tone="danger">{unavailable.detail}</PanelBanner>
  {:else if file}
    <div class="stack">
      {#if state.actionError}<PanelBanner title="The file did not change" tone="attention">{state.actionError}</PanelBanner>{/if}
      {#if state.actionNotice}<PanelBanner title="File updated" tone="intelligence">{state.actionNotice}</PanelBanner>{/if}
      {#if file.native.state === "missing"}
        <PanelBanner title="Native bytes are missing" tone="danger">The manager row remains, but download and semantic processing are unavailable.</PanelBanner>
      {:else if file.native.state === "corrupt"}
        <PanelBanner title="Native bytes failed verification" tone="danger">{file.native.detail}</PanelBanner>
      {/if}

      <section class="identity" aria-labelledby="file-name-heading">
        <div class="section-head"><h3 id="file-name-heading">File</h3><PanelChip>{file.usage.total} {file.usage.total === 1 ? "reference" : "references"}</PanelChip></div>
        {#if state.editingName}
          <div class="inline-editor">
            <Input bind:ref={state.nameInput} bind:value={state.nameDraft} aria-label="File name" maxlength={240} disabled={busy}
              onkeydown={(event) => fileInspector.editKeydown(state, event, () => fileInspector.commitName(state, view, file), file)} />
            <Button size="sm" disabled={busy || state.nameDraft.trim() === ""} onclick={() => fileInspector.commitName(state, view, file)}>{state.pending === "rename" ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel rename" onclick={() => fileInspector.cancelEdit(state, file)}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-value primary" title="Double-click to rename" ondblclick={() => fileInspector.startEdit(state, file, reupload.pending, "name")}><span>{file.name}</span><Pencil size={12} aria-hidden="true" /></button>
        {/if}
        {#if state.editingPath}
          <div class="inline-editor">
            <Input bind:ref={state.pathInput} bind:value={state.pathDraft} aria-label="Destination directory; blank means External Files root" maxlength={512} disabled={busy}
              placeholder="External Files root" onkeydown={(event) => fileInspector.editKeydown(state, event, () => fileInspector.commitPath(state, view, file), file)} />
            <Button size="sm" disabled={busy} onclick={() => fileInspector.commitPath(state, view, file)}>{state.pending === "move" ? "Moving…" : "Move"}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel move" onclick={() => fileInspector.cancelEdit(state, file)}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-value path" title="Double-click to change directory" ondblclick={() => fileInspector.startEdit(state, file, reupload.pending, "path")}><span>{file.relativePath}</span><Pencil size={11} aria-hidden="true" /></button>
        {/if}
      </section>

      <div class="divider" aria-hidden="true"></div><FileDetails />
      <div class="divider" aria-hidden="true"></div>
      <div class="toolbar" role="toolbar" aria-label="File actions">
        <form {...reupload} class="reupload-form" enctype="multipart/form-data">
          <input {...reupload.fields.externalFileId.as("hidden", file.id)} />
          <input {...reupload.fields.baseRevision.as("hidden", file.revision)} />
          <label class:disabled={busy} class="action-link reupload-action">
            <RefreshCw size={13} aria-hidden="true" /> {reupload.pending > 0 ? "Uploading…" : "Re-upload"}
            <input {...reupload.fields.file.as("file")} class="visually-hidden" disabled={busy}
              onchange={(event) => void fileInspector.chooseReplacement(state, event.currentTarget, file, reupload)} />
          </label>
        </form>
        {#if file.native.state === "available"}
          <a class="action-link" href={externalFileDownloadHref(view.project, file.id)} download><Download size={13} aria-hidden="true" /> Download</a>
        {:else}
          <span class="action-link disabled"><Download size={13} aria-hidden="true" /> Download</span>
        {/if}
        <Button variant="ghost" size="sm" disabled={busy} onclick={() => fileInspector.startEdit(state, file, reupload.pending, "path")}><FolderInput aria-hidden="true" /> Move</Button>
        <Button variant="ghost" size="sm" class="delete-action" disabled={busy || file.usage.total > 0}
          title={file.usage.total > 0 ? "Remove references first" : "Delete from project"}
          onclick={() => fileInspector.askToDelete(state, file)}><Trash2 aria-hidden="true" /> Delete</Button>
      </div>

      {#if state.confirmingDelete}
        <section class="delete-confirm" role="alert" aria-labelledby="delete-file-heading">
          <h3 id="delete-file-heading">Delete {file.name} from this project?</h3>
          <p>The manager record and semantic representation are removed. Shared content-addressed bytes remain while another file refers to them.</p>
          <div class="confirm-actions">
            <Button class="confirm-delete" size="sm" disabled={busy} onclick={() => fileInspector.remove(state, view, file, library.current.files.find((candidate) => candidate.id !== file.id)?.id)}>{state.pending === "delete" ? "Deleting…" : "Delete file"}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onclick={() => (state.confirmingDelete = false)}>Cancel</Button>
          </div>
        </section>
      {/if}

      {#if file.subkind === "data"}
        <div class="divider" aria-hidden="true"></div>
        <section aria-labelledby="context-heading">
          <h3 id="context-heading">Dataset context</h3>
          <p class="section-copy">Add the business meaning, collection method, units, or caveats that cannot be inferred safely from rows alone.</p>
          <textarea bind:value={state.contextDraft} maxlength={4000} rows={6} placeholder="What does this dataset represent?" disabled={busy}></textarea>
          <div class="context-actions"><span>{state.contextDraft.length.toLocaleString()} / 4,000</span><Button variant="outline" size="sm" disabled={busy || state.contextDraft.trim() === (file.semanticContext ?? "")} onclick={() => fileInspector.saveContext(state, view, file)}>{state.pending === "context" ? "Saving…" : "Save context"}</Button></div>
        </section>
      {/if}
      <div class="divider" aria-hidden="true"></div><FileSemanticStatus />
      <div class="divider" aria-hidden="true"></div><FileReferences />
    </div>
  {:else}
    <PanelEmpty title="That file is no longer in External Files." />
  {/if}
</Panel>

<style>
  .panel-heading, .action-link, .section-head, .confirm-actions, .inline-editor, .context-actions { display: flex; align-items: center; }
  .panel-heading, .action-link { gap: calc(var(--token-spacing-unit) * 1.5); }
  .stack { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 3); padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 5); }
  h3, p { margin: 0; }
  h3 { color: var(--token-ink-muted); font-size: var(--token-text-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: calc(var(--token-spacing-unit) * 1); }
  .reupload-form { display: contents; }
  .action-link { justify-content: center; min-width: 0; min-height: calc(var(--token-spacing-unit) * 8); cursor: pointer; padding-inline: calc(var(--token-spacing-unit) * 2.5); border-radius: var(--token-radius-control); color: var(--token-ink-secondary); font-size: var(--token-text-caption); white-space: nowrap; }
  .action-link:hover { background: var(--token-surface-panel-hover); color: var(--token-ink-primary); }
  .action-link.disabled { cursor: not-allowed; opacity: .5; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  :global(.delete-action) { color: var(--token-color-danger-text); }
  :global(.confirm-delete) { background: var(--token-color-danger-fill); color: var(--token-color-danger-on-fill); }
  .section-head { justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); }
  .editable-value { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-primary); text-align: start; }
  .editable-value span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .editable-value.primary { margin-top: calc(var(--token-spacing-unit) * 2); font-size: var(--token-text-body-sm); font-weight: 600; }
  .editable-value.path { margin-top: calc(var(--token-spacing-unit) * 1); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: var(--token-text-caption); }
  .editable-value :global(svg) { flex: none; opacity: 0; }
  .editable-value:hover :global(svg), .editable-value:focus-visible :global(svg) { opacity: 1; }
  .inline-editor, .confirm-actions { gap: calc(var(--token-spacing-unit) * 1.5); }
  .inline-editor { margin-top: calc(var(--token-spacing-unit) * 1.5); }
  .delete-confirm { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 2); padding: calc(var(--token-spacing-unit) * 2.5); border: 1px solid var(--token-color-danger-border); border-radius: var(--token-radius-control); background: var(--token-color-danger-surface); }
  .delete-confirm h3 { color: var(--token-color-danger-text); }
  .delete-confirm p, .section-copy { color: var(--token-ink-muted); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  .divider { border-top: 1px solid var(--token-border-subtle); }
  textarea { box-sizing: border-box; width: 100%; margin-top: calc(var(--token-spacing-unit) * 2); resize: vertical; padding: calc(var(--token-spacing-unit) * 2); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); outline: none; background: var(--token-surface-panel); color: var(--token-ink-primary); font: inherit; font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  textarea:focus { border-color: var(--token-border-strong); }
  .section-copy { margin-top: calc(var(--token-spacing-unit) * 2); }
  .context-actions { justify-content: space-between; margin-top: calc(var(--token-spacing-unit) * 1); color: var(--token-ink-muted); font-size: var(--token-text-caption); }
</style>

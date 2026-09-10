<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import FileCog from "@lucide/svelte/icons/file-cog";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import Pencil from "@lucide/svelte/icons/pencil";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  import { Panel, PanelBanner, PanelChip, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
  import { keepExternalFileInspectorCurrent } from "$app-views/categories/external/procedures/effects/file-inspector.svelte";
  import {
    detailIn,
    externalFileDetail,
    externalFileDownloadHref,
    externalFileLibrary,
    externalFileReupload,
    selectedExternalFileIdIn,
    unavailableIn,
  } from "$app-views/categories/external/procedures";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const state = new ExternalFileInspectorState();
  const selectedId = $derived(view.selection?.kind === "external-file" ? view.selection.id : undefined);
  const library = externalFileLibrary();
  const availableIds = $derived(library.ready ? library.current.files.map((file) => file.id) : []);
  const readableId = $derived(selectedExternalFileIdIn(selectedId, availableIds));
  const detail = $derived(externalFileDetail(readableId));
  const answer = $derived(detail !== undefined && detail.ready ? detail.current : undefined);
  const unavailable = $derived(unavailableIn(answer));
  const file = $derived(detailIn(answer, state.now));
  const reupload = externalFileReupload.for("reupload");

  keepExternalFileInspectorCurrent(state, {
    file: () => file,
    reuploadResult: () => reupload.result
  });

  const exactDate = (at: number): string => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(at));

  const material = $derived(file?.semantic.material);
  const exact = $derived(file?.semantic.exact);
  const descriptor = $derived(material?.descriptor);
  const showSemantic = $derived(file !== undefined);
  const busy = $derived(state.busy(reupload.pending));
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
      <div class="toolbar" role="toolbar" aria-label="File actions">
        <Button variant="ghost" size="sm" disabled={busy} onclick={() => state.startName(file, reupload.pending)}><Pencil aria-hidden="true" /> Rename</Button>
        <form {...reupload} class="reupload-form" enctype="multipart/form-data">
          <input {...reupload.fields.externalFileId.as("hidden", file.id)} />
          <input {...reupload.fields.baseRevision.as("hidden", file.revision)} />
          <label class:disabled={busy} class="action-link reupload-action">
            <RefreshCw size={13} aria-hidden="true" /> {reupload.pending > 0 ? "Uploading…" : "Re-upload"}
            <input {...reupload.fields.file.as("file")} class="visually-hidden" disabled={busy}
              onchange={(event) => void state.chooseReplacement(event.currentTarget, file, reupload)} />
          </label>
        </form>
        {#if file.native.state === "available"}
          <a class="action-link" href={externalFileDownloadHref(view.project, file.id)} download><Download size={13} aria-hidden="true" /> Download</a>
        {:else}
          <span class="action-link disabled"><Download size={13} aria-hidden="true" /> Download</span>
        {/if}
        <Button variant="ghost" size="sm" disabled={busy} onclick={() => state.startPath(file, reupload.pending)}><FolderInput aria-hidden="true" /> Move</Button>
        <Button variant="ghost" size="sm" class="delete-action" disabled={busy || file.usage.total > 0}
          title={file.usage.total > 0 ? "Remove references first" : "Delete from project"}
          onclick={() => state.askToDelete(file)}><Trash2 aria-hidden="true" /> Delete</Button>
      </div>

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
              onkeydown={(event) => state.editKeydown(event, () => state.commitName(view, file), file)} />
            <Button size="sm" disabled={busy || state.nameDraft.trim() === ""} onclick={() => state.commitName(view, file)}>{state.pending === "rename" ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel rename" onclick={() => state.cancelEdit(file)}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-value primary" title="Double-click to rename" ondblclick={() => state.startName(file, reupload.pending)}><span>{file.name}</span><Pencil size={12} aria-hidden="true" /></button>
        {/if}
        {#if state.editingPath}
          <div class="inline-editor">
            <Input bind:ref={state.pathInput} bind:value={state.pathDraft} aria-label="Destination directory; blank means External root" maxlength={512} disabled={busy}
              placeholder="External root" onkeydown={(event) => state.editKeydown(event, () => state.commitPath(view, file), file)} />
            <Button size="sm" disabled={busy} onclick={() => state.commitPath(view, file)}>{state.pending === "move" ? "Moving…" : "Move"}</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel move" onclick={() => state.cancelEdit(file)}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-value path" title="Double-click to change directory" ondblclick={() => state.startPath(file, reupload.pending)}><span>{file.relativePath}</span><Pencil size={11} aria-hidden="true" /></button>
        {/if}
      </section>

      {#if state.confirmingDelete}
        <section class="delete-confirm" role="alert" aria-labelledby="delete-file-heading">
          <h3 id="delete-file-heading">Delete {file.name} from this project?</h3>
          <p>The manager record and semantic representation are removed. Shared content-addressed bytes remain while another file refers to them.</p>
          <div class="confirm-actions">
            <Button class="confirm-delete" size="sm" disabled={busy} onclick={() => state.remove(view, file, library.ready ? library.current.files.find((candidate) => candidate.id !== file.id)?.id : undefined)}>{state.pending === "delete" ? "Deleting…" : "Delete file"}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onclick={() => (state.confirmingDelete = false)}>Cancel</Button>
          </div>
        </section>
      {/if}

      <div class="divider" aria-hidden="true"></div>
      <section aria-labelledby="details-heading">
        <h3 id="details-heading">Details</h3>
        <dl>
          <dt>Original</dt><dd title={file.originalName}>{file.originalName}</dd>
          <dt>Type</dt><dd title={file.mediaType}>{file.mediaType}</dd>
          <dt>Kind</dt><dd>{file.subkind}</dd>
          <dt>Size</dt><dd>{file.sizeLabel}</dd>
          <dt>Availability</dt><dd>{file.native.state === "available" ? "Available" : file.native.state === "missing" ? "Missing" : "Corrupt"}</dd>
          <dt>Uploaded</dt><dd title={exactDate(file.createdAt)}>{exactDate(file.createdAt)}</dd>
          <dt>Updated</dt><dd title={exactDate(file.updatedAt)}>{exactDate(file.updatedAt)}</dd>
          <dt>Added by</dt><dd>{file.createdByName}</dd>
          <dt>Updated by</dt><dd>{file.updatedByName}</dd>
          <dt>Origin</dt><dd>{file.origin.label}</dd>
        </dl>
      </section>

      {#if file.subkind === "data"}
        <div class="divider" aria-hidden="true"></div>
        <section aria-labelledby="context-heading">
          <h3 id="context-heading">Dataset context</h3>
          <p class="section-copy">Add the business meaning, collection method, units, or caveats that cannot be inferred safely from rows alone.</p>
          <textarea bind:value={state.contextDraft} maxlength={4000} rows={6} placeholder="What does this dataset represent?" disabled={busy}></textarea>
          <div class="context-actions"><span>{state.contextDraft.length.toLocaleString()} / 4,000</span><Button variant="outline" size="sm" disabled={busy || state.contextDraft.trim() === (file.semanticContext ?? "")} onclick={() => state.saveContext(view, file)}>{state.pending === "context" ? "Saving…" : "Save context"}</Button></div>
        </section>
      {/if}

      {#if showSemantic}
        <div class="divider" aria-hidden="true"></div>
        <section aria-labelledby="semantic-heading">
          <div class="section-head"><h3 id="semantic-heading">Semantic status</h3><span class="semantic-pill {file.semanticTone}">{file.semanticLabel}</span></div>
          {#if exact?.eligible}
            <div class="profile"><h4>Exact text lane</h4><p>Prose is indexed from the original UTF-8 text without a generated summary. {exact.objectCount} semantic {exact.objectCount === 1 ? "object is" : "objects are"} currently published.</p></div>
          {/if}
          {#if material?.error}<p class="semantic-error">{material.error}</p>{/if}
          {#if material?.profile}
            <div class="profile"><h4>{file.subkind === "image" ? "Native visual" : "Material profile"}</h4><ul>
              {#each material.profile.facts as fact}<li>{fact}</li>{/each}
              {#each material.profile.warnings as warning}<li class="warning">{warning}</li>{/each}
            </ul>{#if file.subkind === "image"}<p>The original image is embedded directly; no generated text summary is required.</p>{/if}</div>
          {/if}
          {#if descriptor}
            <div class="summary">
              <div class="summary-title"><Sparkles size={13} aria-hidden="true" /><h4>Generated description</h4></div>
              <p class="summary-body">{descriptor.summary}</p>
              {#if descriptor.purpose}<p><strong>Purpose:</strong> {descriptor.purpose}</p>{/if}
              {#if descriptor.entities.length > 0 || descriptor.themes.length > 0}<div class="chips">{#each [...descriptor.entities, ...descriptor.themes] as value (value)}<PanelChip>{value}</PanelChip>{/each}</div>{/if}
            </div>
          {/if}
          {#if exact?.eligible !== true && material?.eligible !== true}
            <p class="section-copy">This format is retained and downloadable, but it is not currently admitted to a semantic lane.</p>
          {/if}
        </section>
      {/if}

      <div class="divider" aria-hidden="true"></div>
      <section aria-labelledby="references-heading">
        <div class="section-head"><h3 id="references-heading">References</h3><span>{file.usage.total}</span></div>
        {#if file.usage.items.length === 0}
          <p class="section-copy">Nothing in this project currently references this file.</p>
        {:else}
          <ul class="reference-list">{#each file.usage.items as item (`${item.kind}:${item.id}`)}<li><span>{item.name}</span><small>{item.kind}</small></li>{/each}</ul>
          <p class="section-copy">Remove these references before deleting the file.</p>
        {/if}
      </section>
    </div>
  {:else}
    <PanelEmpty title="That file is no longer in External." />
  {/if}
</Panel>

<style>
  .panel-heading, .toolbar, .action-link, .section-head, .summary-title, .chips, .confirm-actions, .inline-editor, .context-actions { display: flex; align-items: center; }
  .panel-heading, .action-link, .summary-title { gap: calc(var(--token-spacing-unit) * 1.5); }
  .stack { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 3); padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 5); }
  h3, h4, p, dl, ul { margin: 0; }
  h3 { color: var(--token-ink-muted); font-size: var(--token-text-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  h4 { color: var(--token-ink-secondary); font-size: var(--token-text-caption); font-weight: 600; }
  .toolbar { flex-wrap: wrap; gap: calc(var(--token-spacing-unit) * 1); padding-bottom: calc(var(--token-spacing-unit) * 2); border-bottom: 1px solid var(--token-border-subtle); }
  .reupload-form { display: contents; }
  .action-link { min-height: calc(var(--token-spacing-unit) * 8); cursor: pointer; padding-inline: calc(var(--token-spacing-unit) * 2.5); border-radius: var(--token-radius-control); color: var(--token-ink-secondary); font-size: var(--token-text-caption); }
  .action-link:hover { background: var(--token-surface-panel-hover); color: var(--token-ink-primary); }
  .action-link.disabled { cursor: not-allowed; opacity: .5; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  :global(.delete-action) { color: var(--token-color-danger-text); }
  :global(.confirm-delete) { background: var(--token-color-danger-fill); color: var(--token-color-danger-on-fill); }
  .section-head { justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); }
  .section-head > span:not(.semantic-pill) { color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  .editable-value { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-primary); text-align: start; }
  .editable-value span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .editable-value.primary { margin-top: calc(var(--token-spacing-unit) * 2); font-size: var(--token-text-body-sm); font-weight: 600; }
  .editable-value.path { margin-top: calc(var(--token-spacing-unit) * 1); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: var(--token-text-caption); }
  .editable-value :global(svg) { flex: none; opacity: 0; }
  .editable-value:hover :global(svg), .editable-value:focus-visible :global(svg) { opacity: 1; }
  .inline-editor { gap: calc(var(--token-spacing-unit) * 1); margin-top: calc(var(--token-spacing-unit) * 1.5); }
  .delete-confirm, .summary, .profile { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 2); padding: calc(var(--token-spacing-unit) * 2.5); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel-hover); }
  .delete-confirm { border-color: var(--token-color-danger-border); background: var(--token-color-danger-surface); }
  .delete-confirm h3 { color: var(--token-color-danger-text); }
  .delete-confirm p, .section-copy, .semantic-error, .summary p, .profile li, .profile p, .reference-list { color: var(--token-ink-muted); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  .confirm-actions, .chips, .inline-editor { gap: calc(var(--token-spacing-unit) * 1.5); }
  .divider { border-top: 1px solid var(--token-border-subtle); }
  dl { display: grid; grid-template-columns: minmax(0, 4.5rem) minmax(0, 1fr); gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2); margin-top: calc(var(--token-spacing-unit) * 2); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  dt { color: var(--token-ink-muted); }
  dd { overflow: hidden; margin: 0; color: var(--token-ink-secondary); text-align: end; text-overflow: ellipsis; white-space: nowrap; }
  textarea { box-sizing: border-box; width: 100%; margin-top: calc(var(--token-spacing-unit) * 2); resize: vertical; padding: calc(var(--token-spacing-unit) * 2); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); outline: none; background: var(--token-surface-panel); color: var(--token-ink-primary); font: inherit; font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  textarea:focus { border-color: var(--token-border-strong); }
  .section-copy { margin-top: calc(var(--token-spacing-unit) * 2); }
  .context-actions { justify-content: space-between; margin-top: calc(var(--token-spacing-unit) * 1); color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  .semantic-pill { display: inline-flex; padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5); border-radius: 999px; background: var(--token-surface-panel-hover); color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  .semantic-pill.current { background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .semantic-pill.queued { background: var(--token-color-attention-surface); color: var(--token-color-attention-text); }
  .semantic-pill.failed, .semantic-error { color: var(--token-color-danger-text); }
  .profile, .summary, .semantic-error { margin-top: calc(var(--token-spacing-unit) * 2); }
  .profile ul { padding-inline-start: calc(var(--token-spacing-unit) * 4); }
  .profile .warning { color: var(--token-color-attention-text); }
  .summary-title { color: var(--token-color-intelligence-text); }
  .summary .summary-body { color: var(--token-ink-primary); font-size: var(--token-text-body-sm); line-height: var(--token-text-body-sm-leading); }
  .chips { flex-wrap: wrap; }
  .reference-list { display: flex; flex-direction: column; margin-top: calc(var(--token-spacing-unit) * 2); padding: 0; list-style: none; }
  .reference-list li { display: flex; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); padding-block: calc(var(--token-spacing-unit) * 1.5); border-bottom: 1px solid var(--token-border-subtle); }
  .reference-list span { overflow: hidden; color: var(--token-ink-secondary); text-overflow: ellipsis; white-space: nowrap; }
  .reference-list small { flex: none; color: var(--token-ink-muted); }
</style>

<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import Download from "@lucide/svelte/icons/download";
  import FileCog from "@lucide/svelte/icons/file-cog";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  import { Panel, PanelBanner, PanelChip, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import {
    detailIn,
    externalFileDetail,
    externalFileDownloadHref,
    externalFileLibrary,
    inspectExternalFile,
    refreshExternalFileSemantics,
    removeExternalFile,
    renameExternalFile,
    selectedExternalFileIdIn,
    unavailableIn,
    type LibraryExternalFileDetail
  } from "$app-views/categories/external/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const selectedId = $derived(
    view.selection?.kind === "external-file" ? view.selection.id : undefined
  );
  const library = externalFileLibrary();
  const availableIds = $derived(
    library.ready ? library.current.files.map((file) => file.id) : []
  );
  const readableId = $derived(selectedExternalFileIdIn(selectedId, availableIds));
  const detail = $derived(externalFileDetail(readableId));
  const answer = $derived(detail !== undefined && detail.ready ? detail.current : undefined);
  const unavailable = $derived(unavailableIn(answer));
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const file = $derived(detailIn(answer, now));

  let editingName = $state(false);
  let nameDraft = $state("");
  let nameBase = $state<LibraryExternalFileDetail>();
  let nameInput = $state<HTMLInputElement | null>(null);
  let confirmingDelete = $state(false);
  let pending = $state<"rename" | "delete" | "semantic">();
  let actionError = $state<string>();
  let activeId = $state<string>();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  $effect(() => {
    if (file?.id === activeId) return;
    activeId = file?.id;
    nameDraft = file?.name ?? "";
    nameBase = undefined;
    editingName = false;
    confirmingDelete = false;
    pending = undefined;
    actionError = undefined;
  });

  const stillInspecting = (tabId: string, id: string): boolean =>
    live &&
    view.activeId === tabId &&
    view.selection?.kind === "external-file" &&
    view.selection.id === id;

  const startRename = async () => {
    if (file === undefined || pending !== undefined) return;
    confirmingDelete = false;
    nameBase = file;
    nameDraft = file.name;
    editingName = true;
    await tick();
    nameInput?.focus();
    nameInput?.select();
  };

  const cancelRename = () => {
    nameDraft = file?.name ?? "";
    nameBase = undefined;
    editingName = false;
  };

  const commitRename = async () => {
    const base = nameBase;
    const name = nameDraft.trim();
    if (base === undefined || file?.id !== base.id || pending !== undefined) return;
    if (name === base.name) {
      cancelRename();
      return;
    }
    if (name === "") {
      actionError = "A display name is required.";
      return;
    }
    const tabId = view.activeId;
    pending = "rename";
    actionError = undefined;
    try {
      const result = await renameExternalFile(view, base, name);
      if (!stillInspecting(tabId, base.id)) return;
      if (!result.accepted) actionError = result.detail;
      else {
        editingName = false;
        nameBase = undefined;
      }
    } catch (error) {
      if (stillInspecting(tabId, base.id)) {
        actionError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      pending = undefined;
    }
  };

  const nameKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void commitRename();
    }
  };

  const refresh = async () => {
    const base = file;
    if (base === undefined || pending !== undefined) return;
    const tabId = view.activeId;
    pending = "semantic";
    actionError = undefined;
    try {
      const result = await refreshExternalFileSemantics(view, base);
      if (!stillInspecting(tabId, base.id)) return;
      if (!result.supported) actionError = "This file type has no semantic ingestion path.";
      const failures = result.supported
        ? [
            ...result.processed.processed.filter((entry) => entry.error !== undefined),
            ...result.processed.materials.processed.filter((entry) => entry.error !== undefined)
          ]
        : [];
      if (failures.length > 0) actionError = failures[0].error;
    } catch (error) {
      if (stillInspecting(tabId, base.id)) {
        actionError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      pending = undefined;
    }
  };

  const remove = async () => {
    const base = file;
    if (base === undefined || pending !== undefined) return;
    const nextId = library.ready
      ? library.current.files.find((candidate) => candidate.id !== base.id)?.id
      : undefined;
    pending = "delete";
    actionError = undefined;
    try {
      const result = await removeExternalFile(view, base);
      if (!result.accepted) {
        actionError = result.detail;
        confirmingDelete = false;
        return;
      }
      if (nextId === undefined) view.showContent("external.library");
      else inspectExternalFile(view, nextId);
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      pending = undefined;
    }
  };

  const exact = $derived(file?.semantic.exact);
  const material = $derived(file?.semantic.material);
  const descriptor = $derived(material?.descriptor);
  const semanticSupported = $derived(
    exact?.eligible === true || material?.eligible === true
  );
</script>

{#snippet heading()}
  <span class="panel-heading"><FileCog size={14} aria-hidden="true" /> File</span>
{/snippet}

<Panel title={file?.name ?? "File"} heading={heading}>
  {#if !library.ready}
    <PanelSkeleton shape="fields" count={7} />
  {:else if readableId === undefined}
    <PanelEmpty title={library.current.files.length === 0 ? "No files exist." : "Select a file to manage it."} />
  {:else if detail === undefined}
    <PanelEmpty title="Select a file to manage it." />
  {:else if detail.error}
    <PanelBanner title="File unavailable" tone="danger">
      {detail.error instanceof Error ? detail.error.message : String(detail.error)}
    </PanelBanner>
  {:else if !detail.ready}
    <PanelSkeleton shape="fields" count={9} />
  {:else if unavailable}
    <PanelBanner title="File metadata unavailable" tone="danger">{unavailable.detail}</PanelBanner>
  {:else if file}
    <div class="stack">
      {#if actionError}
        <PanelBanner title="The file did not change" tone="attention">{actionError}</PanelBanner>
      {/if}
      {#if file.native.state === "missing"}
        <PanelBanner title="Native bytes are missing" tone="danger">
          Metadata remains represented, but this file cannot be downloaded or processed.
        </PanelBanner>
      {:else if file.native.state === "corrupt"}
        <PanelBanner title="Native bytes failed verification" tone="danger">
          {file.native.detail}
        </PanelBanner>
      {/if}

      <section class="identity" aria-labelledby="file-name-heading">
        <h3 id="file-name-heading">Display name</h3>
        {#if editingName}
          <div class="name-editor">
            <Input
              bind:ref={nameInput}
              bind:value={nameDraft}
              aria-label="File display name"
              maxlength={240}
              disabled={pending !== undefined}
              onkeydown={nameKeydown}
            />
            <Button size="sm" disabled={pending !== undefined || nameDraft.trim() === ""} onclick={commitRename}>
              {pending === "rename" ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel rename" onclick={cancelRename}><X aria-hidden="true" /></Button>
          </div>
        {:else}
          <button type="button" class="editable-name" onclick={startRename}>
            <span>{file.name}</span><Pencil size={12} aria-hidden="true" />
          </button>
        {/if}
        <p>Updated {file.updated} by {file.updatedByName}</p>
      </section>

      <div class="toolbar" role="toolbar" aria-label="File actions">
        {#if file.native.state === "available"}
          <a class="action-link" href={externalFileDownloadHref(view.project, file.id)} download>
            <Download size={13} aria-hidden="true" /> Download
          </a>
        {:else}
          <span class="action-link disabled"><Download size={13} aria-hidden="true" /> Download</span>
        {/if}
        <Button
          variant="ghost"
          size="sm"
          class="delete-action"
          disabled={pending !== undefined || file.usage.total > 0}
          title={file.usage.total > 0 ? "Remove represented references first" : "Delete file"}
          onclick={() => {
            editingName = false;
            confirmingDelete = true;
          }}
        ><Trash2 aria-hidden="true" /> Delete</Button>
      </div>

      {#if confirmingDelete}
        <section class="delete-confirm" role="alert" aria-labelledby="delete-file-heading">
          <h3 id="delete-file-heading">Delete {file.name}?</h3>
          <p>The library row and semantic products are removed. Native bytes are removed only when no other file row shares this SHA-256 value.</p>
          <div class="confirm-actions">
            <Button class="confirm-delete" size="sm" disabled={pending !== undefined} onclick={remove}>
              {pending === "delete" ? "Deleting…" : "Delete file"}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending !== undefined} onclick={() => (confirmingDelete = false)}>Cancel</Button>
          </div>
        </section>
      {/if}

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="source-heading">
        <h3 id="source-heading">Source & identity</h3>
        <dl>
          <dt>Original name</dt><dd title={file.originalName}>{file.originalName}</dd>
          <dt>Relative path</dt><dd title={file.relativePath}>{file.relativePath}</dd>
          <dt>Media type</dt><dd>{file.mediaType}</dd>
          <dt>Kind</dt><dd>{file.subkind}</dd>
          <dt>Size</dt><dd>{file.sizeLabel}</dd>
          <dt>Origin</dt><dd>{file.origin.label}</dd>
          <dt>Created by</dt><dd>{file.createdByName}</dd>
          <dt>SHA-256</dt><dd class="hash" title={file.hash}>{file.hash.slice(0, 12)}…</dd>
        </dl>
      </section>

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="semantic-heading">
        <div class="section-head">
          <h3 id="semantic-heading">Semantic products</h3>
          <span class="semantic-pill {file.semanticTone}">{file.semanticLabel}</span>
        </div>
        <dl>
          <dt>Exact text</dt><dd>{exact?.state ?? "unsupported"}{exact?.objectCount ? ` · ${exact.objectCount} spans` : ""}</dd>
          <dt>Material profile</dt><dd>{material?.state ?? "unsupported"}{material?.kind ? ` · ${material.kind}` : ""}</dd>
          <dt>Overlay generation</dt><dd>{file.semantic.overlayGeneration}</dd>
        </dl>
        {#if exact?.error || material?.error}
          <p class="semantic-error">{exact?.error ?? material?.error}</p>
        {/if}
        {#if material?.profile}
          <div class="profile">
            <h4>Profile facts</h4>
            <ul>
              {#each material.profile.facts as fact}<li>{fact}</li>{/each}
              {#each material.profile.warnings as warning}<li class="warning">{warning}</li>{/each}
            </ul>
          </div>
        {/if}
        {#if descriptor}
          <div class="summary">
            <div class="summary-title"><Sparkles size={13} aria-hidden="true" /><h4>Generated summary</h4></div>
            <p>{descriptor.summary}</p>
            {#if descriptor.purpose}<p><strong>Purpose:</strong> {descriptor.purpose}</p>{/if}
            {#if descriptor.entities.length > 0 || descriptor.themes.length > 0}
              <div class="chips">
                {#each [...descriptor.entities, ...descriptor.themes] as value (value)}<PanelChip>{value}</PanelChip>{/each}
              </div>
            {/if}
            {#if descriptor.uncertainty.length > 0}
              <p><strong>Uncertainty:</strong> {descriptor.uncertainty.join(" · ")}</p>
            {/if}
            <small>{descriptor.model} · prompt {descriptor.promptVersion} · {descriptor.coverage.description}</small>
          </div>
        {:else}
          <p class="empty-summary">No generated summary is current. Exact search and deterministic profiles are shown independently.</p>
        {/if}
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== undefined || !semanticSupported || file.native.state !== "available"}
          onclick={refresh}
        ><Sparkles aria-hidden="true" /> {pending === "semantic" ? "Processing…" : "Refresh semantics"}</Button>
      </section>

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="usage-heading">
        <div class="section-head"><h3 id="usage-heading">Usage</h3><span>{file.usage.total}</span></div>
        {#if file.usage.items.length === 0}
          <p class="empty-summary">No represented project resource refers to this file.</p>
        {:else}
          <ul class="usage-list">
            {#each file.usage.items as item (`${item.kind}:${item.id}`)}
              <li><span>{item.name}</span><small>{item.kind}</small></li>
            {/each}
          </ul>
          <p class="empty-summary">Deletion stays disabled until these references are removed.</p>
        {/if}
      </section>
    </div>
  {:else}
    <PanelEmpty title="That file is no longer in External." />
  {/if}
</Panel>

<style>
  .panel-heading,
  .editable-name,
  .toolbar,
  .action-link,
  .section-head,
  .summary-title,
  .chips,
  .confirm-actions,
  .name-editor {
    display: flex;
    align-items: center;
  }

  .panel-heading,
  .editable-name,
  .summary-title,
  .action-link {
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 4);
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 5);
  }

  h3,
  h4,
  p,
  dl,
  ul {
    margin: 0;
  }

  h3 {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  h4 {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    font-weight: 600;
  }

  .identity p,
  .empty-summary,
  .semantic-error,
  .summary p,
  .summary small,
  .profile li,
  .usage-list {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .identity p {
    margin-top: calc(var(--token-spacing-unit) * 1);
  }

  .editable-name {
    width: 100%;
    justify-content: space-between;
    margin-top: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    font-weight: 500;
    text-align: start;
  }

  .editable-name:hover :global(svg) {
    color: var(--token-color-active-text);
  }

  .name-editor,
  .toolbar,
  .confirm-actions,
  .chips {
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .name-editor {
    margin-top: calc(var(--token-spacing-unit) * 1.5);
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .action-link {
    min-height: calc(var(--token-spacing-unit) * 8);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }

  .action-link:hover {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .action-link.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  :global(.delete-action) {
    color: var(--token-color-danger-text);
  }

  :global(.confirm-delete) {
    background: var(--token-color-danger-fill);
    color: var(--token-color-danger-on-fill);
  }

  .delete-confirm,
  .summary,
  .profile {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel-hover);
  }

  .delete-confirm {
    border-color: var(--token-color-danger-border);
    background: var(--token-color-danger-surface);
  }

  .delete-confirm h3 {
    color: var(--token-color-danger-text);
  }

  .delete-confirm p {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .divider {
    border-top: 1px solid var(--token-border-subtle);
  }

  dl {
    display: grid;
    grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    margin-top: calc(var(--token-spacing-unit) * 2);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  dt {
    color: var(--token-ink-muted);
  }

  dd {
    overflow: hidden;
    margin: 0;
    color: var(--token-ink-secondary);
    text-align: end;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hash {
    font-family: var(--token-font-mono);
  }

  .section-head {
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .section-head > span:not(.semantic-pill) {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .semantic-pill {
    display: inline-flex;
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
    border-radius: 999px;
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .semantic-pill.current {
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .semantic-pill.queued {
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .semantic-pill.failed,
  .semantic-error {
    color: var(--token-color-danger-text);
  }

  .profile,
  .summary,
  .empty-summary,
  .semantic-error {
    margin-top: calc(var(--token-spacing-unit) * 2);
  }

  .profile ul {
    padding-inline-start: calc(var(--token-spacing-unit) * 4);
  }

  .profile .warning {
    color: var(--token-color-attention-text);
  }

  .summary-title {
    color: var(--token-color-intelligence-text);
  }

  .summary p {
    color: var(--token-ink-secondary);
  }

  .summary small {
    padding-top: calc(var(--token-spacing-unit) * 1.5);
    border-top: 1px solid var(--token-border-subtle);
  }

  .chips {
    flex-wrap: wrap;
  }

  .usage-list {
    display: flex;
    flex-direction: column;
    margin-top: calc(var(--token-spacing-unit) * 2);
    padding: 0;
    list-style: none;
  }

  .usage-list li {
    display: flex;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding-block: calc(var(--token-spacing-unit) * 1.5);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .usage-list span {
    overflow: hidden;
    color: var(--token-ink-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .usage-list small {
    flex: none;
    color: var(--token-ink-muted);
  }
</style>

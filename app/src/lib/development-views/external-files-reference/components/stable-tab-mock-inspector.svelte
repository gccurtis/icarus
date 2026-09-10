<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import Pencil from "@lucide/svelte/icons/pencil";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { beginMockFileEdit } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/begin-edit";
  import { cancelMockFileEdit } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/cancel-edit";
  import { changeMockEditDraft } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/change-edit-draft";
  import { handleMockEditKey } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/handle-edit-key";
  import { removeMockFile } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/remove-file";
  import { reuploadMockFile } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/reupload";
  import { saveMockFileEdit } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/save-edit";
  import { setMockDeleteConfirmation } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/set-delete-confirmation";
  import { stableTabMockState } from "$development-views/external-files-reference/procedures/stable-tab-mock/context.svelte";
  import {
    mockDirectories,
    mockFileName,
    mockFilePath,
    selectedMockFile
  } from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

  const state = stableTabMockState();
  const selected = $derived(selectedMockFile(state));
  const directories = $derived(mockDirectories(state));
  const selectedDirectoryFileCount = $derived(
    directories.find((entry) => entry.path === state.selectedDirectory)?.files ?? 0
  );
</script>

<aside class="inspector-panel" aria-label="Mock file and directory management Inspector">
  <header>
    <div><PanelRight size={14} aria-hidden="true" /><span>INSPECTOR</span></div>
    <button type="button" aria-label="Close inspector">×</button>
  </header>
  {#if state.selectedDirectory !== undefined}
    <section class="identity">
      <small>FOLDER VIEW</small>
      <div class="name-line"><h3>{state.selectedDirectory}</h3></div>
      <p class="inspector-path">External/{state.selectedDirectory}</p>
    </section>
    <div class="manager-actions">
      <button type="button"><Pencil size={12} aria-hidden="true" /> Rename</button>
      <button type="button"><FolderInput size={12} aria-hidden="true" /> Move</button>
    </div>
    <section>
      <small>DETAILS</small>
      <dl>
        <div><dt>Direct folders</dt><dd>2</dd></div>
        <div><dt>Descendant files</dt><dd>{selectedDirectoryFileCount}</dd></div>
        <div><dt>Storage</dt><dd>Projected total</dd></div>
      </dl>
    </section>
    <section class="context-note">
      <strong>Virtual directory</strong>
      <p>Renaming or moving this view rewrites every descendant path atomically. It never moves native blobs.</p>
    </section>
  {:else if selected === undefined}
    <div class="inspector-empty">
      <strong>Select a file or folder</strong>
      <p>Details and management actions appear here.</p>
    </div>
  {:else}
    <section class="identity">
      <div class="identity-kicker">
        <small>FILE</small><span>{selected.references.length} references</span>
      </div>
      {#if state.editing !== undefined}
        <label for="mock-file-field">{state.editing === "name" ? "Name in Icarus" : "Project path"}</label>
        <input
          id="mock-file-field"
          value={state.editDraft}
          oninput={(event) => changeMockEditDraft(state, event.currentTarget.value)}
          onkeydown={(event) => handleMockEditKey(state, event.key)}
        />
        <div class="inline-actions">
          <button type="button" onclick={() => saveMockFileEdit(state)}>Save</button>
          <button type="button" onclick={() => cancelMockFileEdit(state)}>Cancel</button>
        </div>
      {:else}
        <div class="name-line">
          <h3 ondblclick={() => beginMockFileEdit(state, "name")}>{mockFileName(state, selected)}</h3>
        </div>
        <p class="inspector-path" ondblclick={() => beginMockFileEdit(state, "path")}>
          {mockFilePath(state, selected)}
        </p>
        <small class="edit-hint">Double-click name or path to edit</small>
      {/if}
    </section>

    <div class="manager-actions">
      <button type="button" onclick={() => beginMockFileEdit(state, "name")}><Pencil size={12} aria-hidden="true" /> Rename</button>
      <button type="button" onclick={() => reuploadMockFile(state)}><RefreshCw size={12} aria-hidden="true" /> Re-upload</button>
      <button type="button"><Download size={12} aria-hidden="true" /> Download</button>
      <button type="button" onclick={() => beginMockFileEdit(state, "path")}><FolderInput size={12} aria-hidden="true" /> Move</button>
      <button class="danger-outline" type="button" onclick={() => setMockDeleteConfirmation(state, true)}><Trash2 size={12} aria-hidden="true" /> Delete</button>
    </div>

    <section>
      <small>DETAILS</small>
      <dl>
        <div><dt>Original upload</dt><dd>{selected.originalName}</dd></div>
        <div><dt>Type</dt><dd>{selected.media}</dd></div>
        <div><dt>Size</dt><dd>{selected.size}</dd></div>
        <div><dt>Uploaded</dt><dd>{selected.uploaded}</dd></div>
        <div><dt>Uploaded by</dt><dd>Maya Chen</dd></div>
      </dl>
    </section>
    <section>
      <small>REFERENCES</small>
      {#if selected.references.length}
        <ul class="references">
          {#each selected.references as reference}<li>{reference}</li>{/each}
        </ul>
      {:else}
        <p class="muted">No project references.</p>
      {/if}
    </section>

    {#if selected.type === "CSV"}
      <section>
        <small>DATASET CONTEXT</small>
        <textarea aria-label="Dataset context">{selected.context}</textarea>
        <button class="save-context" type="button">Save context</button>
      </section>
    {/if}

    {#if selected.semanticMode === "descriptor"}
      <section class="summary-section">
        <div class="summary-head">
          <small>MATERIAL SUMMARY</small>
          <span class="semantic-badge {selected.semanticTone}">{selected.semantic}</span>
        </div>
        <p class="summary">{selected.summary}</p>
        <p class="profile">{selected.profile}</p>
      </section>
    {:else if selected.semanticMode === "visual"}
      <section class="summary-section">
        <div class="summary-head">
          <small>SEMANTIC REPRESENTATION</small>
          <span class="semantic-badge current">Visual ready</span>
        </div>
        <p class="summary">The original image is embedded directly as one native visual object. No generated text summary is added.</p>
        <p class="profile">{selected.profile}</p>
      </section>
    {/if}

    {#if state.confirmingDelete}
      <section class="delete-confirm" role="alert">
        <strong>Delete {mockFileName(state, selected)}?</strong>
        <p>Deletion is refused while live references exist. Otherwise semantic forget/outbox, History, and row removal commit together before the row's native claim is released.</p>
        <div class="inline-actions">
          <button
            class="danger"
            type="button"
            disabled={selected.references.length > 0}
            onclick={() => removeMockFile(state)}
          >Delete file</button>
          <button type="button" onclick={() => setMockDeleteConfirmation(state, false)}>Cancel</button>
        </div>
      </section>
    {/if}
  {/if}
</aside>

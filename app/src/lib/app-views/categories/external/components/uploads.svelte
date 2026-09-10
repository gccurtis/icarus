<script lang="ts">
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import Upload from "@lucide/svelte/icons/upload";

  import { Button } from "$vendored-components/button";
  import { keepExternalUploadsCurrent } from "$app-views/categories/external/procedures/effects/uploads.svelte";
  import { externalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import { externalFileUpload } from "$app-views/categories/external/procedures/upload";
  import { receiveLibraryPicker } from "$app-views/categories/external/procedures/receive-library-picker";

  const { state, view } = externalLibraryContext();
  const fileUpload = externalFileUpload.for("files");
  const folderUpload = externalFileUpload.for("folder");
  const pending = $derived(fileUpload.pending + folderUpload.pending > 0);
  keepExternalUploadsCurrent(state, view, {
    fileResult: () => fileUpload.result,
    folderResult: () => folderUpload.result
  });
</script>

<div class="upload-bar" aria-label="External file ingestion">
  <form {...fileUpload} class="upload-form" enctype="multipart/form-data">
    {#each state.filePaths as path, index (index)}
      <input {...fileUpload.fields.relativePaths[index].as("hidden", path)} />
    {/each}
    <label class="pick-action">
      <Upload size={14} aria-hidden="true" />
      <span>{state.fileCount === 0 ? "Choose files" : `${state.fileCount} selected`}</span>
      <input {...fileUpload.fields.files.as("file multiple")} class="visually-hidden"
        onchange={(event) => receiveLibraryPicker(state, event.currentTarget, "files", (paths) => fileUpload.fields.relativePaths.set(paths))} />
    </label>
    <Button type="submit" size="sm" disabled={pending || state.fileCount === 0}>
      {fileUpload.pending > 0 ? "Uploading…" : "Upload files"}
    </Button>
  </form>
  <form {...folderUpload} class="upload-form" enctype="multipart/form-data">
    {#each state.folderPaths as path, index (index)}
      <input {...folderUpload.fields.relativePaths[index].as("hidden", path)} />
    {/each}
    <label class="pick-action secondary">
      <FolderUp size={14} aria-hidden="true" />
      <span>{state.folderCount === 0 ? "Choose folder" : `${state.folderCount} selected`}</span>
      <input {...folderUpload.fields.files.as("file multiple")} class="visually-hidden"
        webkitdirectory={true}
        onchange={(event) => receiveLibraryPicker(state, event.currentTarget, "folder", (paths) => folderUpload.fields.relativePaths.set(paths))} />
    </label>
    <Button type="submit" variant="outline" size="sm" disabled={pending || state.folderCount === 0}>
      {folderUpload.pending > 0 ? "Uploading…" : "Upload folder"}
    </Button>
  </form>
</div>

<style>
  .upload-bar, .upload-form { display: flex; align-items: center; gap: calc(var(--token-spacing-unit) * 2); }
  .upload-bar { flex-wrap: wrap; justify-content: flex-end; }
  .pick-action { display: inline-flex; min-height: calc(var(--token-spacing-unit) * 8); cursor: pointer; align-items: center; gap: calc(var(--token-spacing-unit) * 1.5); padding-inline: calc(var(--token-spacing-unit) * 2.5); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-secondary); font-size: var(--token-text-caption); }
  .pick-action:hover { border-color: var(--token-border-strong); color: var(--token-ink-primary); }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 58rem) { .upload-bar { justify-content: flex-start; } }
</style>

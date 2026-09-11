<script lang="ts">
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import Upload from "@lucide/svelte/icons/upload";

  import { Button } from "$vendored-components/button";
  import { keepExternalUploadsCurrent } from "$app-views/categories/external/procedures/effects/uploads.svelte";
  import { externalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import { externalFileUpload } from "$app-views/categories/external/procedures/upload";
  import { chooseLibraryUpload } from "$app-views/categories/external/procedures/choose-library-upload";

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
    <Button type="button" size="sm" disabled={pending} onclick={() => state.fileInput?.click()}>
      <Upload size={14} aria-hidden="true" />
      {fileUpload.pending > 0 ? "Uploading…" : "Upload files"}
    </Button>
    <input bind:this={state.fileInput} {...fileUpload.fields.files.as("file multiple")} hidden
      disabled={pending}
      onchange={(event) => void chooseLibraryUpload(state, event.currentTarget, "files", (paths) => fileUpload.fields.relativePaths.set(paths), fileUpload)} />
  </form>
  <form {...folderUpload} class="upload-form" enctype="multipart/form-data">
    {#each state.folderPaths as path, index (index)}
      <input {...folderUpload.fields.relativePaths[index].as("hidden", path)} />
    {/each}
    <Button type="button" variant="outline" size="sm" disabled={pending} onclick={() => state.folderInput?.click()}>
      <FolderUp size={14} aria-hidden="true" />
      {folderUpload.pending > 0 ? "Uploading…" : "Upload folder"}
    </Button>
    <input bind:this={state.folderInput} {...folderUpload.fields.files.as("file multiple")} hidden
      disabled={pending}
      webkitdirectory={true}
      onchange={(event) => void chooseLibraryUpload(state, event.currentTarget, "folder", (paths) => folderUpload.fields.relativePaths.set(paths), folderUpload)} />
  </form>
</div>

<style>
  .upload-bar, .upload-form { display: flex; align-items: center; gap: calc(var(--token-spacing-unit) * 2); }
  .upload-bar { flex-wrap: wrap; justify-content: flex-end; }
  @media (max-width: 58rem) { .upload-bar { justify-content: flex-start; } }
</style>

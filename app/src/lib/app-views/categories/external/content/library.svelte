<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import Braces from "@lucide/svelte/icons/braces";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import File from "@lucide/svelte/icons/file";
  import FileText from "@lucide/svelte/icons/file-text";
  import FileImage from "@lucide/svelte/icons/file-image";
  import FileMusic from "@lucide/svelte/icons/file-music";
  import FileVideo from "@lucide/svelte/icons/file-video";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import Table2 from "@lucide/svelte/icons/table-2";
  import Upload from "@lucide/svelte/icons/upload";

  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeader,
    ScreenNote,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
  import { keepExternalLibraryCurrent } from "$app-views/categories/external/procedures/effects/library.svelte";
  import {
    externalDirectoriesIn,
    externalFileLibrary,
    externalFileUpload,
    externalFilesIn,
    inspectExternalDirectory,
    inspectExternalFile,
    type LibraryExternalDirectory,
    type LibraryExternalFile
  } from "$app-views/categories/external/procedures";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const state = new ExternalLibraryState();
  const library = externalFileLibrary();
  const fileUpload = externalFileUpload.for("files");
  const folderUpload = externalFileUpload.for("folder");
  const answer = $derived(library.ready ? library.current : undefined);
  const files = $derived(externalFilesIn(answer, state.now));
  const directories = $derived(externalDirectoriesIn(answer));
  const unavailable = $derived(answer?.unavailable ?? []);

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "size", label: "Size" },
    { value: "kind", label: "Kind" }
  ] as const;
  const KINDS = ["text", "code", "data", "image", "audio", "video", "unknown"] as const;
  const KIND_LABEL = {
    text: "Text",
    code: "Code",
    data: "Structured data",
    image: "Image",
    audio: "Audio",
    video: "Video",
    unknown: "Other"
  } as const;
  const KIND_ICON = {
    text: FileText,
    code: Braces,
    data: Table2,
    image: FileImage,
    audio: FileMusic,
    video: FileVideo,
    unknown: File
  } as const;

  const query = $derived(state.search.trim().toLocaleLowerCase());
  const matchesSemantic = (row: LibraryExternalFile): boolean => {
    if (state.semantic === "all") return true;
    if (state.semantic === "current") return row.semanticTone === "current";
    if (state.semantic === "queued") return row.semanticTone === "queued";
    if (state.semantic === "attention") return row.semanticTone === "failed";
    return row.semanticTone === "limited";
  };
  const filtered = $derived(files
    .filter((row) => state.kind === "all" || row.subkind === state.kind)
    .filter(matchesSemantic)
    .filter((row) => query === "" ||
      `${row.name} ${row.originalName} ${row.relativePath} ${row.mediaType}`
        .toLocaleLowerCase().includes(query)));
  const compare = (left: LibraryExternalFile, right: LibraryExternalFile): number => {
    if (state.sortBy === "name") return left.name.localeCompare(right.name);
    if (state.sortBy === "size") return left.size - right.size;
    if (state.sortBy === "kind") {
      return KIND_LABEL[left.subkind].localeCompare(KIND_LABEL[right.subkind]) ||
        left.name.localeCompare(right.name);
    }
    return right.updatedAt - left.updatedAt || left.name.localeCompare(right.name);
  };
  const ordered = $derived([...filtered].sort((left, right) =>
    state.direction === "asc" ? compare(left, right) : -compare(left, right)));
  const filtersActive = $derived(
    query !== "" || state.kind !== "all" || state.semantic !== "all"
  );
  const selectedFile = (id: string): boolean =>
    view.selection?.kind === "external-file" && view.selection.id === id;
  const selectedDirectory = (path: string): boolean =>
    view.selection?.kind === "external-directory" && view.selection.id === path;
  const directFiles = $derived(ordered.filter((row) => {
    const split = row.relativePath.lastIndexOf("/");
    return (split < 0 ? "" : row.relativePath.slice(0, split)) === state.currentDirectory;
  }));
  const visibleFiles = $derived(state.mode === "table" ? ordered : directFiles);
  const directDirectories = $derived(directories.filter((row) =>
    row.relativePath !== "" && row.parentPath === state.currentDirectory));
  const current = $derived(
    directories.find((row) => row.relativePath === state.currentDirectory)
  );
  const crumbs = $derived.by(() => {
    const segments = state.currentDirectory.split("/").filter(Boolean);
    return [
      { label: "External", path: "" },
      ...segments.map((label, index) => ({ label, path: segments.slice(0, index + 1).join("/") }))
    ];
  });
  const enterDirectory = (directory: LibraryExternalDirectory) => {
    state.currentDirectory = directory.relativePath;
    inspectExternalDirectory(view, directory.relativePath);
  };

  keepExternalLibraryCurrent(state, view, {
    fileResult: () => fileUpload.result,
    folderResult: () => folderUpload.result,
    ready: () => library.ready,
    files: () => files,
    directories: () => directories
  });

  const uploadResult = $derived(state.latestUploadResult);
  const pending = $derived(fileUpload.pending + folderUpload.pending > 0);
</script>

<ScreenSurface>
  <div class="library-stack">
    <ScreenHeader title="External">
      {#snippet actions()}
        <div class="upload-bar" aria-label="External file ingestion">
          <form {...fileUpload} class="upload-form" enctype="multipart/form-data">
            {#each state.filePaths as path, index (index)}
              <input {...fileUpload.fields.relativePaths[index].as("hidden", path)} />
            {/each}
            <label class="pick-action">
              <Upload size={14} aria-hidden="true" />
              <span>{state.fileCount === 0 ? "Choose files" : `${state.fileCount} selected`}</span>
              <input {...fileUpload.fields.files.as("file multiple")} class="visually-hidden"
                onchange={(event) => state.receive(event.currentTarget, "files", (paths) => fileUpload.fields.relativePaths.set(paths))} />
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
                onchange={(event) => state.receive(event.currentTarget, "folder", (paths) => folderUpload.fields.relativePaths.set(paths))} />
            </label>
            <Button type="submit" variant="outline" size="sm" disabled={pending || state.folderCount === 0}>
              {folderUpload.pending > 0 ? "Uploading…" : "Upload folder"}
            </Button>
          </form>
        </div>
      {/snippet}
    </ScreenHeader>

    <div class="library-lead">
      <p>Native project files live here as one managed library. Select a file or virtual directory to manage it in the Inspector; External never opens a file-type editor.</p>
      <div class="view-switcher" role="group" aria-label="Library view">
        <Button variant={state.mode === "table" ? "secondary" : "ghost"} size="sm" aria-pressed={state.mode === "table"} onclick={() => (state.mode = "table")}>
          <Table2 aria-hidden="true" /> Table
        </Button>
        <Button variant={state.mode === "directory" ? "secondary" : "ghost"} size="sm" aria-pressed={state.mode === "directory"} onclick={() => (state.mode = "directory")}>
          <FolderTree aria-hidden="true" /> Directory
        </Button>
      </div>
    </div>

    {#if uploadResult}
      <ScreenNote tone={uploadResult.rejected > 0 ? "gap" : "muted"}>
        {uploadResult.uploaded} uploaded · {uploadResult.reused} already present · {uploadResult.rejected} rejected.
        {#each uploadResult.outcomes.filter((outcome) => outcome.status === "rejected") as outcome}
          <span class="receipt-error">{outcome.name}: {outcome.detail}</span>
        {/each}
      </ScreenNote>
    {/if}

    {#if library.error}
      <div class="remote-state">
        <ScreenEmpty title="The External library could not be loaded">
          {library.error instanceof Error ? library.error.message : String(library.error)}
        </ScreenEmpty>
        <Button variant="outline" size="sm" onclick={() => library.refresh()}>Retry library</Button>
      </div>
    {:else if !library.ready}
      <ScreenEmpty title="Loading External">Reading project-owned file metadata.</ScreenEmpty>
    {:else}
      {#if unavailable.length > 0}
        <ScreenNote tone="gap">{unavailable.length} represented file {unavailable.length === 1 ? "row is" : "rows are"} hidden because its metadata did not pass admission.</ScreenNote>
      {/if}

      <ScreenGroup label={state.mode === "table" ? "All files" : (current?.name ?? "External")} count={String(state.mode === "table" ? files.length : (current?.descendantFileCount ?? files.length))}>
        <div class="table-stack">
          <ScreenFilters placeholder="Search names, paths, or media types" sorts={SORTS} bind:sort={state.sortBy} bind:value={state.search}>
            <select class="filter-control" bind:value={state.kind} aria-label="File kind">
              <option value="all">All kinds</option>
              {#each KINDS as option (option)}<option value={option}>{KIND_LABEL[option]}</option>{/each}
            </select>
            <select class="filter-control" bind:value={state.semantic} aria-label="Semantic status">
              <option value="all">All semantic states</option>
              <option value="current">Ready</option>
              <option value="queued">In progress</option>
              <option value="attention">Needs attention</option>
              <option value="limited">Stored only</option>
            </select>
            {#snippet order()}
              <Button variant="ghost" size="icon-sm" aria-label={state.direction === "asc" ? "Reverse order" : "Restore order"}
                onclick={() => (state.direction = state.direction === "asc" ? "desc" : "asc")}>
                {#if state.direction === "asc"}<ArrowUpNarrowWide aria-hidden="true" />{:else}<ArrowDownNarrowWide aria-hidden="true" />{/if}
              </Button>
            {/snippet}
          </ScreenFilters>

          {#if state.mode === "directory"}
            <nav class="breadcrumbs" aria-label="External directory">
              {#each crumbs as crumb, index (crumb.path)}
                {#if index > 0}<ChevronRight size={12} aria-hidden="true" />{/if}
                <button type="button" aria-current={crumb.path === state.currentDirectory ? "page" : undefined}
                  onclick={() => (state.currentDirectory = crumb.path)}>{crumb.label}</button>
              {/each}
            </nav>
          {/if}

          {#if visibleFiles.length === 0 && (state.mode === "table" || directDirectories.length === 0)}
            <ScreenEmpty kind={filtersActive ? "no-matches" : "nothing-yet"}
              title={filtersActive ? "No file matches" : "No external files yet"}
              onclear={filtersActive ? () => state.clearFilters() : undefined}>
              {filtersActive ? "Try another name, kind, or semantic state." : "Choose files or a folder above. Unsupported formats remain safely stored and downloadable."}
            </ScreenEmpty>
          {:else if state.mode === "table"}
            <ScreenTable columns={["Name", "Path", "Kind", "Size", "Meaning", "Updated"]}>
              {#each visibleFiles as row (row.id)}
                {@const Icon = KIND_ICON[row.subkind]}
                <ScreenRow selected={selectedFile(row.id)} onselect={() => inspectExternalFile(view, row.id)} onopen={() => inspectExternalFile(view, row.id)}>
                  <ScreenCell><button class="item-name" type="button" onclick={() => inspectExternalFile(view, row.id)}><Icon size={14} aria-hidden="true" /><span>{row.name}</span></button></ScreenCell>
                  <ScreenCell><span class="truncate" title={row.relativePath}>{row.relativePath}</span></ScreenCell>
                  <ScreenCell>{KIND_LABEL[row.subkind]}</ScreenCell>
                  <ScreenCell num>{row.sizeLabel}</ScreenCell>
                  <ScreenCell><span class="semantic-pill {row.semanticTone}">{row.semanticLabel}</span></ScreenCell>
                  <ScreenCell num>{row.updated}</ScreenCell>
                </ScreenRow>
              {/each}
            </ScreenTable>
          {:else}
            <ScreenTable columns={["Name", "Type", "Contents", "Size", "Updated"]}>
              {#each directDirectories as directory (directory.relativePath)}
                <ScreenRow selected={selectedDirectory(directory.relativePath)} onselect={() => inspectExternalDirectory(view, directory.relativePath)} onopen={() => enterDirectory(directory)}>
                  <ScreenCell><button class="item-name" type="button" ondblclick={() => enterDirectory(directory)} onclick={() => inspectExternalDirectory(view, directory.relativePath)}><Folder size={15} aria-hidden="true" /><span>{directory.name}</span></button></ScreenCell>
                  <ScreenCell>Folder</ScreenCell>
                  <ScreenCell num>{directory.descendantFileCount} {directory.descendantFileCount === 1 ? "file" : "files"}</ScreenCell>
                  <ScreenCell num>{directory.sizeLabel}</ScreenCell>
                  <ScreenCell num>—</ScreenCell>
                </ScreenRow>
              {/each}
              {#each visibleFiles as row (row.id)}
                {@const Icon = KIND_ICON[row.subkind]}
                <ScreenRow selected={selectedFile(row.id)} onselect={() => inspectExternalFile(view, row.id)} onopen={() => inspectExternalFile(view, row.id)}>
                  <ScreenCell><button class="item-name" type="button" onclick={() => inspectExternalFile(view, row.id)}><Icon size={14} aria-hidden="true" /><span>{row.name}</span></button></ScreenCell>
                  <ScreenCell>{KIND_LABEL[row.subkind]}</ScreenCell>
                  <ScreenCell><span class="semantic-pill {row.semanticTone}">{row.semanticLabel}</span></ScreenCell>
                  <ScreenCell num>{row.sizeLabel}</ScreenCell>
                  <ScreenCell num>{row.updated}</ScreenCell>
                </ScreenRow>
              {/each}
            </ScreenTable>
          {/if}
        </div>
      </ScreenGroup>
    {/if}
  </div>
</ScreenSurface>

<style>
  .library-stack, .table-stack, .remote-state { display: flex; min-width: 0; flex-direction: column; gap: calc(var(--token-spacing-unit) * 3); }
  .library-stack { gap: calc(var(--token-spacing-unit) * 5); }
  .library-lead { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 4); }
  .library-lead p { max-width: 54rem; margin: 0; color: var(--token-ink-muted); font-size: var(--token-text-body-sm); line-height: var(--token-text-body-sm-leading); }
  .view-switcher, .upload-bar, .upload-form, .breadcrumbs, .item-name { display: flex; align-items: center; }
  .view-switcher, .upload-bar, .upload-form { gap: calc(var(--token-spacing-unit) * 2); }
  .view-switcher, .upload-bar { flex-wrap: wrap; justify-content: flex-end; }
  .pick-action { display: inline-flex; min-height: calc(var(--token-spacing-unit) * 8); cursor: pointer; align-items: center; gap: calc(var(--token-spacing-unit) * 1.5); padding-inline: calc(var(--token-spacing-unit) * 2.5); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-secondary); font-size: var(--token-text-caption); }
  .pick-action:hover { border-color: var(--token-border-strong); color: var(--token-ink-primary); }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  .filter-control { height: calc(var(--token-spacing-unit) * 8); min-width: 8rem; padding-inline: calc(var(--token-spacing-unit) * 2); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-secondary); font-size: var(--token-text-caption); }
  .breadcrumbs { min-height: calc(var(--token-spacing-unit) * 8); gap: calc(var(--token-spacing-unit) * 1); padding-inline: calc(var(--token-spacing-unit) * 1); color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  .breadcrumbs button { color: var(--token-ink-muted); }
  .breadcrumbs button[aria-current="page"] { color: var(--token-ink-primary); font-weight: 600; }
  .breadcrumbs button:hover { text-decoration: underline; }
  .item-name { min-height: calc(var(--token-spacing-unit) * 8); gap: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-primary); text-align: start; }
  .item-name:hover span { text-decoration: underline; }
  .item-name :global(svg) { flex: none; color: var(--token-ink-muted); }
  .semantic-pill { display: inline-flex; padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5); border-radius: 999px; background: var(--token-surface-panel-hover); color: var(--token-ink-muted); font-size: var(--token-text-caption); white-space: nowrap; }
  .semantic-pill.current { background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .semantic-pill.queued { background: var(--token-color-attention-surface); color: var(--token-color-attention-text); }
  .semantic-pill.failed { background: var(--token-color-danger-surface); color: var(--token-color-danger-text); }
  .receipt-error { display: block; margin-top: calc(var(--token-spacing-unit) * 1); }
  @media (max-width: 58rem) { .library-lead { align-items: flex-start; flex-direction: column; } .upload-bar { justify-content: flex-start; } }
</style>

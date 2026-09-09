<script lang="ts">
  import { onMount } from "svelte";
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import File from "@lucide/svelte/icons/file";
  import FileImage from "@lucide/svelte/icons/file-image";
  import FileMusic from "@lucide/svelte/icons/file-music";
  import FileText from "@lucide/svelte/icons/file-text";
  import FileVideo from "@lucide/svelte/icons/file-video";
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
  import {
    externalFileLibrary,
    externalFileUpload,
    externalFilesIn,
    inspectExternalFile,
    type LibraryExternalFile
  } from "$app-views/categories/external/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = externalFileLibrary();
  const fileUpload = externalFileUpload.for("files");
  const folderUpload = externalFileUpload.for("folder");
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const files = $derived(externalFilesIn(library.ready ? library.current : undefined, now));
  const unavailable = $derived(library.ready ? library.current.unavailable : []);

  let fileCount = $state(0);
  let folderCount = $state(0);
  // Remote result getters may produce a fresh proxy. Compare their serializable
  // receipt instead of object identity so each submission is consumed once.
  let handledFiles = $state<string>();
  let handledFolder = $state<string>();
  let latestUploadResult: typeof fileUpload.result = $state.raw();

  const receive = (
    form: typeof fileUpload,
    input: HTMLInputElement,
    setCount: (count: number) => void
  ) => {
    const selected = Array.from(input.files ?? []);
    setCount(selected.length);
    form.fields.relativePaths.set(
      selected.map((file) => file.webkitRelativePath || file.name)
    );
  };

  const inspectFirst = (result: typeof fileUpload.result) => {
    const first = result?.outcomes.find((outcome) => outcome.status !== "rejected");
    if (first !== undefined) inspectExternalFile(view, first.externalFileId);
  };

  $effect(() => {
    const result = fileUpload.result;
    if (result === undefined) return;
    const receipt = JSON.stringify(result);
    if (receipt === handledFiles) return;
    handledFiles = receipt;
    latestUploadResult = result;
    fileCount = 0;
    inspectFirst(result);
  });

  $effect(() => {
    const result = folderUpload.result;
    if (result === undefined) return;
    const receipt = JSON.stringify(result);
    if (receipt === handledFolder) return;
    handledFolder = receipt;
    latestUploadResult = result;
    folderCount = 0;
    inspectFirst(result);
  });

  let search = $state("");
  let kind = $state("all");
  let semantic = $state("all");
  let sortBy = $state("updated");
  let direction = $state<"asc" | "desc">("asc");

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "size", label: "Size" },
    { value: "kind", label: "Kind" }
  ] as const;

  const KINDS = ["text", "data", "image", "audio", "video", "unknown"] as const;
  const KIND_LABEL = {
    text: "Text / code",
    data: "Data",
    image: "Image",
    audio: "Audio",
    video: "Video",
    unknown: "Other"
  } as const;
  const KIND_ICON = {
    text: FileText,
    data: Table2,
    image: FileImage,
    audio: FileMusic,
    video: FileVideo,
    unknown: File
  } as const;

  const query = $derived(search.trim().toLocaleLowerCase());
  const matchesSemantic = (row: LibraryExternalFile): boolean => {
    if (semantic === "all") return true;
    if (semantic === "current") return row.semanticTone === "current";
    if (semantic === "queued") return row.semanticTone === "queued";
    if (semantic === "attention") return row.semanticTone === "failed";
    return row.semanticTone === "limited";
  };
  const filtered = $derived(
    files
      .filter((row) => kind === "all" || row.subkind === kind)
      .filter(matchesSemantic)
      .filter((row) =>
        query === "" ||
        `${row.name} ${row.originalName} ${row.relativePath} ${row.mediaType}`
          .toLocaleLowerCase()
          .includes(query)
      )
  );
  const compare = (left: LibraryExternalFile, right: LibraryExternalFile): number => {
    if (sortBy === "name") return left.name.localeCompare(right.name);
    if (sortBy === "size") return (left.size ?? -1) - (right.size ?? -1);
    if (sortBy === "kind") {
      return KIND_LABEL[left.subkind].localeCompare(KIND_LABEL[right.subkind]) ||
        left.name.localeCompare(right.name);
    }
    return right.updatedAt - left.updatedAt || left.name.localeCompare(right.name);
  };
  const ordered = $derived(
    [...filtered].sort((left, right) =>
      direction === "asc" ? compare(left, right) : -compare(left, right)
    )
  );
  const filtersActive = $derived(query !== "" || kind !== "all" || semantic !== "all");
  const selected = (id: string): boolean =>
    view.selection?.kind === "external-file" && view.selection.id === id;
  const clear = () => {
    search = "";
    kind = "all";
    semantic = "all";
  };

  $effect(() => {
    const focus = view.active.focus;
    if (!library.ready || focus === undefined) return;
    if (view.selection?.kind === "external-file" && view.selection.id === focus) return;
    if (files.some((row) => row.id === focus)) inspectExternalFile(view, focus);
  });

  const uploadResult = $derived(latestUploadResult);
  const pending = $derived(fileUpload.pending + folderUpload.pending > 0);
</script>

<ScreenSurface>
  <div class="library-stack">
    <ScreenHeader title="External">
      {#snippet actions()}
        <div class="upload-bar" aria-label="External file ingestion">
          <form {...fileUpload} class="upload-form" enctype="multipart/form-data">
            <label class="pick-action">
              <Upload size={14} aria-hidden="true" />
              <span>{fileCount === 0 ? "Choose files" : `${fileCount} selected`}</span>
              <input
                {...fileUpload.fields.files.as("file multiple")}
                class="visually-hidden"
                onchange={(event) => receive(fileUpload, event.currentTarget, (count) => (fileCount = count))}
              />
            </label>
            <Button type="submit" size="sm" disabled={pending || fileCount === 0}>
              {fileUpload.pending > 0 ? "Uploading…" : "Upload files"}
            </Button>
          </form>
          <form {...folderUpload} class="upload-form" enctype="multipart/form-data">
            <label class="pick-action secondary">
              <FolderUp size={14} aria-hidden="true" />
              <span>{folderCount === 0 ? "Choose folder" : `${folderCount} selected`}</span>
              <input
                {...folderUpload.fields.files.as("file multiple")}
                class="visually-hidden"
                webkitdirectory={true}
                onchange={(event) => receive(folderUpload, event.currentTarget, (count) => (folderCount = count))}
              />
            </label>
            <Button type="submit" variant="outline" size="sm" disabled={pending || folderCount === 0}>
              {folderUpload.pending > 0 ? "Uploading…" : "Upload folder"}
            </Button>
          </form>
        </div>
      {/snippet}
    </ScreenHeader>

    <p class="library-intro">
      Project files that remain in their native format. Select a row to manage it; files do not open editors or tabs of their own.
    </p>

    {#if uploadResult}
      <ScreenNote tone={uploadResult.rejected > 0 ? "gap" : "muted"}>
        {uploadResult.uploaded} uploaded · {uploadResult.reused} reused · {uploadResult.rejected} rejected.
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
        <ScreenNote tone="gap">
          {unavailable.length} stored {unavailable.length === 1 ? "file is" : "files are"} hidden because its represented metadata is invalid.
        </ScreenNote>
      {/if}

      <ScreenGroup label="All files" count={String(files.length)}>
        <div class="table-stack">
          <ScreenFilters
            placeholder="Search names, paths, or media types"
            sorts={SORTS}
            bind:sort={sortBy}
            bind:value={search}
          >
            <select class="filter-control" bind:value={kind} aria-label="File kind">
              <option value="all">All kinds</option>
              {#each KINDS as option (option)}
                <option value={option}>{KIND_LABEL[option]}</option>
              {/each}
            </select>
            <select class="filter-control" bind:value={semantic} aria-label="Semantic status">
              <option value="all">All semantic states</option>
              <option value="current">Ready</option>
              <option value="queued">In progress</option>
              <option value="attention">Needs attention</option>
              <option value="limited">Managed only</option>
            </select>
            {#snippet order()}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={direction === "asc" ? "Reverse order" : "Restore order"}
                onclick={() => (direction = direction === "asc" ? "desc" : "asc")}
              >
                {#if direction === "asc"}<ArrowUpNarrowWide aria-hidden="true" />{:else}<ArrowDownNarrowWide aria-hidden="true" />{/if}
              </Button>
            {/snippet}
          </ScreenFilters>

          {#if ordered.length === 0}
            <ScreenEmpty
              kind={filtersActive ? "no-matches" : "nothing-yet"}
              title={filtersActive ? "No file matches" : "No external files yet"}
              onclear={filtersActive ? clear : undefined}
            >
              {filtersActive
                ? "Try another name, kind, or semantic state."
                : "Choose files or a folder above. Native bytes stay downloadable even when their type has no semantic extractor."}
            </ScreenEmpty>
          {:else}
            <ScreenTable columns={["Name", "Path", "Kind", "Size", "Meaning", "Updated"]}>
              {#each ordered as row (row.id)}
                {@const Icon = KIND_ICON[row.subkind]}
                <ScreenRow
                  selected={selected(row.id)}
                  onselect={() => inspectExternalFile(view, row.id)}
                  onopen={() => inspectExternalFile(view, row.id)}
                >
                  <ScreenCell>
                    <button class="file-name" type="button" onclick={() => inspectExternalFile(view, row.id)}>
                      <Icon size={14} aria-hidden="true" />
                      <span>{row.name}</span>
                    </button>
                  </ScreenCell>
                  <ScreenCell><span class="truncate" title={row.relativePath}>{row.relativePath}</span></ScreenCell>
                  <ScreenCell>{KIND_LABEL[row.subkind]}</ScreenCell>
                  <ScreenCell num>{row.sizeLabel}</ScreenCell>
                  <ScreenCell><span class="semantic-pill {row.semanticTone}">{row.semanticLabel}</span></ScreenCell>
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
  .library-stack,
  .table-stack,
  .remote-state {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .library-stack {
    gap: calc(var(--token-spacing-unit) * 6);
  }

  .library-intro {
    max-width: 52rem;
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .upload-bar,
  .upload-form {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .upload-bar {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .pick-action {
    display: inline-flex;
    min-height: calc(var(--token-spacing-unit) * 8);
    cursor: pointer;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }

  .pick-action:hover {
    border-color: var(--token-border-strong);
    color: var(--token-ink-primary);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .filter-control {
    height: calc(var(--token-spacing-unit) * 8);
    min-width: 8rem;
    padding-inline: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }

  .file-name {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 8);
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-primary);
    text-align: start;
  }

  .file-name:hover span {
    text-decoration: underline;
  }

  .file-name :global(svg) {
    flex: none;
    color: var(--token-ink-muted);
  }

  .semantic-pill {
    display: inline-flex;
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
    border-radius: 999px;
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    white-space: nowrap;
  }

  .semantic-pill.current {
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .semantic-pill.queued {
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .semantic-pill.failed {
    background: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
  }

  .receipt-error {
    display: block;
    margin-top: calc(var(--token-spacing-unit) * 1);
  }
</style>

<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import File from "@lucide/svelte/icons/file";
  import FileImage from "@lucide/svelte/icons/file-image";
  import FileMusic from "@lucide/svelte/icons/file-music";
  import FileText from "@lucide/svelte/icons/file-text";
  import FileVideo from "@lucide/svelte/icons/file-video";
  import Table2 from "@lucide/svelte/icons/table-2";

  import { ScreenCell, ScreenRow, ScreenTable } from "$authored-components/screen";
  import { externalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import { EXTERNAL_LIBRARY_COLUMNS } from "$app-views/categories/external/procedures/library-columns";
  import {
    externalFileIsSelected,
    KIND_LABEL
  } from "$app-views/categories/external/procedures/library-view";
  import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";

  const context = externalLibraryContext();
  const files = $derived(context.visibleFiles());
  const { view } = context;
  const icons = {
    text: FileText,
    code: Braces,
    data: Table2,
    image: FileImage,
    audio: FileMusic,
    video: FileVideo,
    unknown: File
  } as const;
</script>

<div class="external-table"><ScreenTable columns={EXTERNAL_LIBRARY_COLUMNS}>
  {#each files as row (row.id)}
    {@const Icon = icons[row.subkind]}
    <ScreenRow selected={externalFileIsSelected(view, row.id)}
      onselect={() => inspectExternalFile(view, row.id)} onopen={() => inspectExternalFile(view, row.id)}>
      <ScreenCell><button class="item-name" type="button" title={row.name} onclick={() => inspectExternalFile(view, row.id)}><Icon size={14} aria-hidden="true" /><span>{row.name}</span></button></ScreenCell>
      <ScreenCell><span class="file-path" title={row.relativePath}>{row.relativePath}</span></ScreenCell>
      <ScreenCell>{KIND_LABEL[row.subkind]}</ScreenCell>
      <ScreenCell num><span class="file-size">{row.sizeLabel}</span></ScreenCell>
      <ScreenCell><span class="file-author" title={`Last updated by ${row.updatedByName}`}>{row.updatedByName}</span></ScreenCell>
      <ScreenCell><span class="semantic-status {row.semanticTone}">{row.semanticLabel}</span></ScreenCell>
      <ScreenCell num><span class="file-updated" title={new Date(row.updatedAt).toLocaleString()}>{row.updated}</span></ScreenCell>
    </ScreenRow>
  {/each}
</ScreenTable></div>

<style>
  .item-name { display: flex; min-height: calc(var(--token-spacing-unit) * 8); align-items: center; gap: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-primary); text-align: start; }
  .item-name:hover span { text-decoration: underline; }
  .item-name span { max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-name :global(svg) { flex: none; color: var(--token-ink-muted); }
  .file-path { display: block; width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--token-ink-muted); }
  .file-size { display: inline-block; min-width: 4.5rem; white-space: nowrap; }
  .file-author { display: block; max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-updated { white-space: nowrap; }
  .semantic-status { color: var(--token-ink-muted); font-size: var(--token-text-caption); font-weight: 600; }
  .semantic-status.current { color: var(--token-color-success-text); }
  .semantic-status.queued { color: var(--token-color-attention-text); }
  .semantic-status.failed { color: var(--token-color-danger-text); }
  .external-table :global(th:last-child) { text-transform: none; }
</style>

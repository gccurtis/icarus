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

<ScreenTable columns={["Name", "Path", "Kind", "Size", "Meaning", "Updated"]}>
  {#each files as row (row.id)}
    {@const Icon = icons[row.subkind]}
    <ScreenRow selected={externalFileIsSelected(view, row.id)}
      onselect={() => inspectExternalFile(view, row.id)} onopen={() => inspectExternalFile(view, row.id)}>
      <ScreenCell><button class="item-name" type="button" onclick={() => inspectExternalFile(view, row.id)}><Icon size={14} aria-hidden="true" /><span>{row.name}</span></button></ScreenCell>
      <ScreenCell><span class="truncate" title={row.relativePath}>{row.relativePath}</span></ScreenCell>
      <ScreenCell>{KIND_LABEL[row.subkind]}</ScreenCell>
      <ScreenCell num>{row.sizeLabel}</ScreenCell>
      <ScreenCell><span class="semantic-pill {row.semanticTone}">{row.semanticLabel}</span></ScreenCell>
      <ScreenCell num>{row.updated}</ScreenCell>
    </ScreenRow>
  {/each}
</ScreenTable>

<style>
  .item-name { display: flex; min-height: calc(var(--token-spacing-unit) * 8); align-items: center; gap: calc(var(--token-spacing-unit) * 2); color: var(--token-ink-primary); text-align: start; }
  .item-name:hover span { text-decoration: underline; }
  .item-name :global(svg) { flex: none; color: var(--token-ink-muted); }
  .semantic-pill { display: inline-flex; padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5); border-radius: 999px; background: var(--token-surface-panel-hover); color: var(--token-ink-muted); font-size: var(--token-text-caption); white-space: nowrap; }
  .semantic-pill.current { background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .semantic-pill.queued { background: var(--token-color-attention-surface); color: var(--token-color-attention-text); }
  .semantic-pill.failed { background: var(--token-color-danger-surface); color: var(--token-color-danger-text); }
</style>

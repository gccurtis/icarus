<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";

  import { ScreenFilters } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { externalLibraryContext } from "$app-views/categories/external/procedures/library-context.svelte";
  import { KIND_LABEL } from "$app-views/categories/external/procedures/library-view";
  import { toggleLibraryDirection } from "$app-views/categories/external/procedures/toggle-library-direction";

  const context = externalLibraryContext();
  const { state } = context;
  const authors = $derived(context.authors());
  const sorts = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "size", label: "Size" },
    { value: "kind", label: "Kind" }
  ] as const;
  const kinds = ["text", "code", "data", "image", "audio", "video", "unknown"] as const;
</script>

<ScreenFilters placeholder="Search names, paths, or media types" sorts={sorts}
  bind:sort={state.sortBy} bind:value={state.search}>
  <select class="filter-control" bind:value={state.kind} aria-label="File kind">
    <option value="all">All kinds</option>
    {#each kinds as option (option)}<option value={option}>{KIND_LABEL[option]}</option>{/each}
  </select>
  <select class="filter-control" bind:value={state.author} aria-label="Author" title="Last updated by">
    <option value="">All authors</option>
    {#each authors as author (author)}<option value={author}>{author}</option>{/each}
  </select>
  <select class="filter-control" bind:value={state.semantic} aria-label="Semantic status">
    <option value="all">All semantic states</option>
    <option value="current">Ready</option>
    <option value="queued">In progress</option>
    <option value="attention">Needs attention</option>
    <option value="limited">Stored only</option>
  </select>
  {#snippet order()}
    <Button variant="ghost" size="icon-sm"
      aria-label={state.direction === "asc" ? "Reverse order" : "Restore order"}
      onclick={() => toggleLibraryDirection(state)}>
      {#if state.direction === "asc"}
        <ArrowUpNarrowWide aria-hidden="true" />
      {:else}
        <ArrowDownNarrowWide aria-hidden="true" />
      {/if}
    </Button>
  {/snippet}
</ScreenFilters>

<style>
  .filter-control { height: calc(var(--token-spacing-unit) * 8); min-width: 8rem; padding-inline: calc(var(--token-spacing-unit) * 2); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-secondary); font-size: var(--token-text-caption); }
</style>

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
  const kindTitle = $derived(state.kind === "all" ? "All kinds" : KIND_LABEL[state.kind as keyof typeof KIND_LABEL]);
  const authorTitle = $derived(state.author === "" ? "All authors" : state.author);
  const statusTitle = $derived({
    all: "All statuses",
    current: "Ready",
    queued: "In progress",
    attention: "Needs attention",
    limited: "Stored only"
  }[state.semantic] ?? "All statuses");
</script>

<ScreenFilters placeholder="Search names, paths, or media types" sorts={sorts}
  bind:sort={state.sortBy} bind:value={state.search}>
  <select class="filter-control kind-filter" bind:value={state.kind} aria-label="File kind" title={kindTitle}>
    <option value="all" title="All kinds">All kinds</option>
    {#each kinds as option (option)}<option value={option} title={KIND_LABEL[option]}>{KIND_LABEL[option]}</option>{/each}
  </select>
  <select class="filter-control author-filter" bind:value={state.author} aria-label="Author" title={authorTitle}>
    <option value="" title="All authors">All authors</option>
    {#each authors as author (author)}<option value={author} title={author}>{author}</option>{/each}
  </select>
  <select class="filter-control status-filter" bind:value={state.semantic} aria-label="Status" title={statusTitle}>
    <option value="all" title="All statuses">All statuses</option>
    <option value="current" title="Ready">Ready</option>
    <option value="queued" title="In progress">In progress</option>
    <option value="attention" title="Needs attention">Needs attention</option>
    <option value="limited" title="Stored only">Stored only</option>
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
  .filter-control { min-width: 0; height: calc(var(--token-spacing-unit) * 8); flex: 0 1 auto; overflow: hidden; padding-inline: calc(var(--token-spacing-unit) * 2); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-secondary); font-size: var(--token-text-caption); text-overflow: ellipsis; white-space: nowrap; }
  .kind-filter { width: 8.5rem; }
  .author-filter, .status-filter { width: 9rem; }
</style>

<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";

  import { ScreenFilters } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import {
    DIRECTION,
    ORIGIN_KINDS,
    SORTS,
    STATES,
    STATE_LABEL,
    agentsLibrary,
    type SortKey
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { ORIGIN_LABEL } from "$app-views/categories/agents/procedures/vocabulary";

  let {
    persona = $bindable("any"),
    query = $bindable(""),
    kind = $bindable("any"),
    taskState = $bindable("any"),
    sort = $bindable("started"),
    direction = $bindable("asc"),
    withPersona = true
  }: {
    persona?: string;
    query?: string;
    kind?: string;
    taskState?: string;
    sort?: string;
    direction?: string;
    withPersona?: boolean;
  } = $props();

  const library = agentsLibrary();
  const personas = $derived(library.ready ? library.current.personas : []);
  const sortKey = $derived(sort as SortKey);
  const way = $derived(direction === "desc" ? "desc" : "asc");
</script>

<ScreenFilters placeholder="Search tasks" sorts={SORTS} bind:sort bind:value={query}>
  {#if withPersona}
    <select class="filter" bind:value={persona} aria-label="Persona">
      <option value="any">Any persona</option>
      {#each personas as row (row.id)}
        <option value={row.id}>{row.name}</option>
      {/each}
    </select>
  {/if}
  <select class="filter" bind:value={kind} aria-label="Type">
    <option value="any">Any type</option>
    {#each ORIGIN_KINDS as option (option)}
      <option value={option}>{ORIGIN_LABEL[option]}</option>
    {/each}
  </select>
  <select class="filter" bind:value={taskState} aria-label="State">
    <option value="any">Any state</option>
    {#each STATES as option (option)}
      <option value={option}>{STATE_LABEL[option]}</option>
    {/each}
  </select>

  {#snippet order()}
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={DIRECTION[sortKey][way]}
      title={DIRECTION[sortKey][way]}
      onclick={() => (direction = way === "asc" ? "desc" : "asc")}
    >
      {#if way === "asc"}
        <ArrowUpNarrowWide aria-hidden="true" />
      {:else}
        <ArrowDownNarrowWide aria-hidden="true" />
      {/if}
    </Button>
  {/snippet}
</ScreenFilters>

<style>
  .filter {
    height: calc(var(--token-spacing-unit) * 7);
    padding: 0 calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }
</style>

<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";

  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenNote,
    ScreenRow,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import type { ResourceTableRow } from "$authored-components/resource-table/types";
  import { ResourceTableState } from "$authored-components/resource-table/resource-table.state.svelte";
  import {
    DIRECTION,
    SORTS,
    WITHOUT_FILES,
    tableRows
  } from "$authored-components/resource-table/procedures/table-rows";

  let {
    resources,
    kindLabels,
    kindPlurals,
    ready,
    failed,
    unavailable = 0,
    selectedId,
    onretry,
    onselect,
    onopen
  }: {
    resources: readonly ResourceTableRow[];
    kindLabels: Readonly<Record<string, string>>;
    kindPlurals: Readonly<Record<string, string>>;
    ready: boolean;
    failed: boolean;
    unavailable?: number;
    selectedId?: string;
    onretry: () => void;
    onselect: (id: string) => void;
    onopen: (id: string) => void;
  } = $props();

  const filters = new ResourceTableState();
  const rows = $derived(tableRows(resources, filters, kindLabels, kindPlurals));
  const kindTitle = $derived(
    filters.kind === "all"
      ? "All kinds"
      : filters.kind === WITHOUT_FILES
        ? "Less external"
        : kindPlurals[filters.kind]
  );
  const actorTitle = $derived(filters.actor === "all" ? "Anyone" : filters.actor);
</script>

<ScreenGroup label="Resources" fill>
  <ScreenFilters
    placeholder="Search this project"
    fluidSearch
    sorts={SORTS}
    bind:sort={filters.sortBy}
    bind:value={filters.search}
  >
    <select
      class="resource-filter kind-filter border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
      bind:value={filters.kind}
      aria-label="Kind"
      title={kindTitle}
    >
      <option value="all" title="All kinds">All kinds</option>
      {#if rows.kinds.includes("file")}
        <option value={WITHOUT_FILES} title="Less external">Less external</option>
      {/if}
      {#each rows.kinds as option (option)}
        <option value={option} title={kindPlurals[option]}>{kindPlurals[option]}</option>
      {/each}
    </select>
    <select
      class="resource-filter actor-filter border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
      bind:value={filters.actor}
      aria-label="Updated by"
      title={actorTitle}
    >
      <option value="all" title="Anyone">Anyone</option>
      {#each rows.actors as name (name)}
        <option value={name} title={name}>{name}</option>
      {/each}
    </select>

    {#snippet order()}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={DIRECTION[filters.sortBy][filters.direction]}
        title={DIRECTION[filters.sortBy][filters.direction]}
        onclick={() => (filters.direction = filters.direction === "asc" ? "desc" : "asc")}
      >
        {#if filters.direction === "asc"}
          <ArrowUpNarrowWide aria-hidden="true" />
        {:else}
          <ArrowDownNarrowWide aria-hidden="true" />
        {/if}
      </Button>
    {/snippet}
  </ScreenFilters>

  {#if ready && unavailable > 0}
    <ScreenNote tone="gap">
      {unavailable} represented
      {unavailable === 1 ? "resource is" : "resources are"}
      hidden because stored metadata is invalid.
    </ScreenNote>
  {/if}

  {#if failed}
    <div class="resource-state">
      <ScreenEmpty title="Project resources could not be loaded">
        The represented resource index returned an error. Retry without treating the project as empty.
      </ScreenEmpty>
      <Button variant="outline" size="sm" onclick={onretry}>
        Retry resource index
      </Button>
    </div>
  {:else if !ready}
    <ScreenEmpty title="Loading project resources">
      Reading the project-scoped resource index.
    </ScreenEmpty>
  {:else if rows.listed.length === 0}
    <ScreenEmpty kind="no-matches" title="Nothing in this project matches" onclear={() => filters.clear()}>
      Search covers represented documents, presentations, spreadsheets, research, and findings.
    </ScreenEmpty>
  {:else}
    <ScreenTable scroll columns={["Name", "Kind", "Updated", "Updated by"]}>
      {#each rows.listed as row (row.id)}
        <ScreenRow
          selected={selectedId === row.id}
          onselect={() => onselect(row.id)}
          onopen={() => onopen(row.id)}
        >
          <ScreenCell>
            <button
              type="button"
              class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
              onclick={() => onselect(row.id)}
              ondblclick={() => onopen(row.id)}
              onkeydown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onopen(row.id);
              }}
            >
              {row.name}
            </button>
          </ScreenCell>
          <ScreenCell>{kindLabels[row.kind]}</ScreenCell>
          <ScreenCell num>{row.updated}</ScreenCell>
          <ScreenCell>{row.updatedBy}</ScreenCell>
        </ScreenRow>
      {/each}
    </ScreenTable>
  {/if}
</ScreenGroup>

<style>
  .resource-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .resource-filter {
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kind-filter {
    width: 8.5rem;
  }

  .actor-filter {
    width: 10rem;
  }
</style>

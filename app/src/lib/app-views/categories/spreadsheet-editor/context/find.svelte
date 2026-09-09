<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelEmpty,
    PanelInput,
    PanelRow,
    PanelSearch,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { hitsOf, replaceOps, type Hit } from "$app-views/categories/spreadsheet-editor/procedures/find";
  import { cellSignal, selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const MODES = [
    { value: "find", label: "Find" },
    { value: "replace", label: "Find and replace" }
  ];

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const facts = $derived(factsOf(sheetId, sheet));

  let query = $state("");
  let replacement = $state("");
  let mode = $state("find");
  let matchCase = $state(false);

  const hits = $derived(sheet === undefined ? [] : hitsOf(sheet, grid, query, matchCase, facts));
  const current = $derived(selectedRef(view.selection));

  const isCurrent = (hit: Hit): boolean =>
    current !== undefined && current.rowId === hit.ref.rowId && current.columnId === hit.ref.columnId;

  const commit = (ops: Parameters<SpreadsheetRuntime["apply"]>[0]) => {
    if (ops.length === 0 || sheet === undefined) return;
    runtime?.apply(recalculating(view.project, sheetId, sheet, ops));
  };

  const show = (hit: Hit) => {
    if (sheet === undefined || runtime === undefined) return;
    runtime.scrollTo = hit.ref;
    const signal = cellSignal(sheet, grid, hit.ref, hits.map((held) => held.ref));
    view.inspect(signal.key, signal.selection);
  };

  const replaceOne = (hit: Hit) => {
    if (sheet === undefined) return;
    commit(replaceOps(sheet, grid, [hit], replacement, facts));
  };

  const replaceEvery = () => {
    if (sheet === undefined) return;
    commit(replaceOps(sheet, grid, hits, replacement, facts));
  };

  const replacing = (hit: Hit): string =>
    `Replace “${hit.match}” with “${replacement}” in ${hit.label}`;
</script>

<Panel title="Find">
  {#if sheet}
    <PanelSearch
      placeholder="Find in this sheet…"
      matched={query.length === 0 ? undefined : hits.length}
      empty={query.length === 0 ? "Type to search the sheet." : "Nothing matches."}
      flush
      bind:value={query}
    >
      <div class="controls">
        <div class="toggle">
          <span class="text-body-sm text-ink-secondary">Match case</span>
          <PanelToggle label="Match case" checked={matchCase} onchange={(next) => (matchCase = next)} />
        </div>
        <PanelSelect label="Mode" value={mode} options={MODES} onchange={(next) => (mode = next)} />
        {#if mode === "replace"}
          <PanelInput label="Replace with" placeholder="Replace with…" flush bind:value={replacement} />
          <div class="flex">
            <PanelButton
              label="Replace all ({hits.length})"
              tone="primary"
              disabled={hits.length === 0}
              title={hits.length === 0 ? undefined : `Replace every match with “${replacement}”`}
              onclick={replaceEvery}
            />
          </div>
        {/if}
      </div>
      {#each hits as hit (hit.id)}
        <PanelRow
          title={`${hit.label} · ${hit.match}`}
          sub={`${hit.before}[${hit.match}]${hit.after}`}
          selected={isCurrent(hit)}
          onselect={() => show(hit)}
        >
          {#snippet control()}
            {#if mode === "replace"}
              <PanelButton label="Replace" tone="ghost" title={replacing(hit)} onclick={() => replaceOne(hit)} />
            {/if}
          {/snippet}
        </PanelRow>
      {/each}
    </PanelSearch>
  {:else}
    <PanelEmpty title="Open a spreadsheet to search it" />
  {/if}
</Panel>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2);
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
  }
</style>

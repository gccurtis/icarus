<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelEmpty, PanelRow, PanelSearch } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { STYLE } from "$app-views/categories/spreadsheet-editor/procedures/selection-kinds";
  import { selectedRects } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { styleSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { appliedStyle, newStyle, styleRows } from "$app-views/categories/spreadsheet-editor/procedures/styles";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const rows = $derived(sheet === undefined ? [] : styleRows(sheet));

  let filter = $state("");

  const shown = $derived(
    rows.filter((row) => row.style.name.toLowerCase().includes(filter.trim().toLowerCase()))
  );

  const rects = $derived(selectedRects(grid, view.selection));
  const canApply = $derived(rects.length > 0 && (view.selection?.kind === "cell" || view.selection?.kind === "range"));
  const chosen = $derived(view.selection?.kind === STYLE ? view.selection.id : undefined);

  const open = (key: string) => {
    const signal = styleSignal(key);
    view.inspect(signal.key, signal.selection);
  };

  const create = () => {
    if (sheet === undefined) return;
    const made = newStyle(sheet.body);
    runtime?.apply(made.ops);
    open(made.key);
  };

  const applyTo = (key: string) => {
    if (sheet === undefined || !canApply) return;
    runtime?.apply(appliedStyle(sheet.body, grid, rects, key));
  };

</script>

<Panel title="Styles">
  {#if sheet}
    <div class="actions">
      <PanelButton label="New style" icon={Plus} tone="primary" onclick={create} />
    </div>
    <PanelSearch
      placeholder="Filter styles…"
      bind:value={filter}
      matched={filter === "" ? undefined : shown.length}
      total={rows.length}
      empty="No style has that name."
    >
      {#each shown as row (row.key)}
        <PanelRow
          title={row.style.name}
          sub={`${row.isDefault ? "default · " : ""}${row.shorthand}`}
          selected={chosen === row.key}
          onselect={() => open(row.key)}
        >
          {#snippet control()}
            <Button
              variant="outline"
              size="xs"
              disabled={!canApply}
              title={canApply ? "Write a rule over the selection" : "Select cells on the grid first"}
              onclick={(event) => {
                event.stopPropagation();
                applyTo(row.key);
              }}
            >
              Apply
            </Button>
          {/snippet}
        </PanelRow>
      {/each}
    </PanelSearch>
  {:else}
    <PanelEmpty title="Open a spreadsheet to see its styles" />
  {/if}
</Panel>

<style>
  .actions {
    display: flex;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
  }
</style>

<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelControlGroup,
    PanelControlRow,
    PanelCrumbs,
    PanelEmpty,
    PanelNumber
  } from "$authored-components/panel";
  import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { selectedRects, selectedRowIds } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { aggregateOf } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import {
    DEFAULT_ROW_HEIGHT,
    duplicatedRows,
    fittedRow,
    insertedRows,
    removedRows,
    resizedRow
  } from "$app-views/categories/spreadsheet-editor/procedures/structure";
  import { pixelsOf, pointsOf } from "$app-views/categories/spreadsheet-editor/procedures/units";
  import { isInspectorView, workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ids = $derived(selectedRowIds(view.selection).filter((id) => grid.rowAt.has(id)));
  const indices = $derived(ids.map((id) => grid.rowAt.get(id) as number).sort((a, b) => a - b));
  const last = $derived(indices.length === 0 ? 0 : indices[indices.length - 1]);
  const label = $derived(
    indices.length === 0 ? "Row" : indices.length === 1 ? `Row ${indices[0] + 1}` : `Rows ${indices[0] + 1} to ${last + 1}`
  );
  const rects = $derived(selectedRects(grid, view.selection));
  const total = $derived(sheet === undefined ? undefined : aggregateOf(sheet, grid, rects));
  const heights = $derived([...new Set(ids.map((id) => grid.rows[grid.rowAt.get(id) as number].height ?? DEFAULT_ROW_HEIGHT))]);

  const apply = (ops: Edit["ops"]) => {
    if (ops.length === 0 || sheet === undefined) return;
    runtime?.apply(recalculating(sheetId, sheet, ops));
  };

  const resize = (points: number) => {
    const height = pixelsOf(points);
    apply(ids.flatMap((id) => {
      const op = resizedRow(grid, id, height);
      return op === undefined ? [] : [op];
    }));
  };

  const fit = () => {
    if (sheet === undefined) return;
    apply(ids.flatMap((id) => {
      const op = fittedRow(sheet, grid, id);
      return op === undefined ? [] : [op];
    }));
  };

  const insert = (where: "above" | "below") => {
    if (indices.length === 0) return;
    const after = where === "above" ? (indices[0] === 0 ? null : grid.rows[indices[0] - 1].id) : grid.rows[last].id;
    apply(insertedRows(after, indices.length).ops);
  };

  const duplicate = () => {
    if (sheet === undefined) return;
    apply(duplicatedRows(sheet, grid, ids));
  };

  const remove = () => {
    if (sheet === undefined || ids.length === 0 || ids.length >= grid.rows.length) return;
    apply(removedRows(sheet, grid, ids));
    view.inspect("spreadsheet-editor.spreadsheet");
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label }]} onnavigate={navigate} />
  {/snippet}

  {#if sheet && ids.length > 0 && total}
    <PanelControlGroup>
      <PanelControlRow label="Cells">
        <span class="text-body-sm text-ink-primary tabular-nums">{total.filled}</span>
      </PanelControlRow>
      <div class="sizing">
        <button type="button" class="fit text-caption text-ink-muted hover:text-ink-primary" title="Fit the height to the content" onclick={fit}>
          Height (pt)
        </button>
        <PanelNumber label="Height in points" value={pointsOf(heights[0] ?? DEFAULT_ROW_HEIGHT)} min={12} max={300} step={0.5} flush onchange={resize} />
      </div>
      <PanelControlRow label="Insert">
        <PanelButton label="Above" onclick={() => insert("above")} />
        <PanelButton label="Below" onclick={() => insert("below")} />
      </PanelControlRow>
    </PanelControlGroup>

    <div class="actions">
      <PanelButton label="Duplicate" onclick={duplicate} />
      <PanelButton
        label="Remove"
        tone="danger"
        disabled={ids.length >= grid.rows.length}
        title={ids.length >= grid.rows.length ? "A sheet keeps at least one row" : undefined}
        onclick={remove}
      />
    </div>
  {:else}
    <PanelEmpty title="Click a row number on the grid" />
  {/if}
</Panel>

<style>
  .sizing {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(4.5rem, auto) minmax(0, 1fr);
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .fit {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: start;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }
</style>

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
  import { columnLabel, gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { selectedColumnIds, selectedRects } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { aggregateOf } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import {
    DEFAULT_COLUMN_WIDTH,
    duplicatedColumns,
    fittedColumn,
    frozenColumnsSet,
    insertedColumns,
    removedColumns,
    resizedColumn
  } from "$app-views/categories/spreadsheet-editor/procedures/structure";
  import { pixelsOf, pointsOf } from "$app-views/categories/spreadsheet-editor/procedures/units";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const register = variableRegister();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ids = $derived(selectedColumnIds(view.selection).filter((id) => grid.columnAt.has(id)));
  const indices = $derived(ids.map((id) => grid.columnAt.get(id) as number).sort((a, b) => a - b));
  const last = $derived(indices.length === 0 ? 0 : indices[indices.length - 1]);
  const label = $derived(
    indices.length === 0
      ? "Column"
      : indices.length === 1
        ? `Column ${columnLabel(indices[0])}`
        : `Columns ${columnLabel(indices[0])} to ${columnLabel(last)}`
  );
  const rects = $derived(selectedRects(grid, view.selection));
  const total = $derived(sheet === undefined ? undefined : aggregateOf(sheet, grid, rects));
  const widths = $derived([...new Set(ids.map((id) => grid.columns[grid.columnAt.get(id) as number].width ?? DEFAULT_COLUMN_WIDTH))]);
  const frozenHere = $derived(indices.length > 0 && (sheet?.body.frozenColumns ?? 0) === last + 1);

  const apply = (ops: Edit["ops"]) => {
    if (ops.length === 0 || sheet === undefined) return;
    runtime?.apply(recalculating(register, sheetId, sheet, ops));
  };

  const resize = (points: number) => {
    const width = pixelsOf(points);
    apply(ids.flatMap((id) => {
      const op = resizedColumn(grid, id, width);
      return op === undefined ? [] : [op];
    }));
  };

  const fit = () => {
    if (sheet === undefined) return;
    apply(ids.flatMap((id) => {
      const op = fittedColumn(sheet, grid, id);
      return op === undefined ? [] : [op];
    }));
  };

  const insert = (where: "left" | "right") => {
    if (indices.length === 0) return;
    const after = where === "left" ? (indices[0] === 0 ? null : grid.columns[indices[0] - 1].id) : grid.columns[last].id;
    apply(insertedColumns(after, indices.length).ops);
  };

  const duplicate = () => {
    if (sheet === undefined) return;
    apply(duplicatedColumns(sheet, grid, ids));
  };

  const freeze = () => {
    if (sheet === undefined || indices.length === 0) return;
    const op = frozenColumnsSet(sheet.body, frozenHere ? 0 : last + 1);
    if (op !== undefined) apply([op]);
  };

  const remove = () => {
    if (sheet === undefined || ids.length === 0 || ids.length >= grid.columns.length) return;
    apply(removedColumns(sheet, grid, ids));
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
        <button type="button" class="fit text-caption text-ink-muted hover:text-ink-primary" title="Fit the width to the content" onclick={fit}>
          Width (pt)
        </button>
        <PanelNumber label="Width in points" value={pointsOf(widths[0] ?? DEFAULT_COLUMN_WIDTH)} min={18} max={450} step={0.5} flush onchange={resize} />
      </div>
      <PanelControlRow label="Insert">
        <PanelButton label="Left" onclick={() => insert("left")} />
        <PanelButton label="Right" onclick={() => insert("right")} />
      </PanelControlRow>
    </PanelControlGroup>

    <div class="actions">
      <PanelButton label={frozenHere ? "Unfreeze" : "Freeze here"} onclick={freeze} />
      <PanelButton label="Duplicate" onclick={duplicate} />
      <PanelButton
        label="Remove"
        tone="danger"
        disabled={ids.length >= grid.columns.length}
        title={ids.length >= grid.columns.length ? "A sheet keeps at least one column" : undefined}
        onclick={remove}
      />
    </div>
  {:else}
    <PanelEmpty title="Click a column heading on the grid" />
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

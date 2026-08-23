<script lang="ts">
  import type {
    AnalyticTableModel,
    AnalyticTableSelectionTarget
  } from "$json-store/types/data/analytic";
  import { formatAnalyticValue } from "$lib/unique-components/analytic/analytic-model";

  let {
    analyticId,
    table,
    height = 300,
    selected,
    onselect
  }: {
    analyticId: string;
    table: AnalyticTableModel;
    height?: number;
    selected?: AnalyticTableSelectionTarget;
    onselect?: (target: AnalyticTableSelectionTarget) => void;
  } = $props();

  const selectedKey = $derived(
    selected === undefined
      ? undefined
      : selected.kind === "table"
        ? selected.tableId
        : selected.kind === "table-column"
          ? selected.columnId
          : selected.kind === "table-row"
            ? selected.rowId
            : selected.cellId
  );

  const column = (columnId: string) => table.columns.find((entry) => entry.id === columnId);
</script>

<div class="analytic-table" style:height={`${height}px`}>
  <table>
    <thead>
      <tr>
        <th class="row-heading" aria-hidden="true"></th>
        {#each table.columns as one (one.id)}
          <th scope="col">
            <button
              type="button"
              class:selected={selectedKey === one.id}
              aria-pressed={selectedKey === one.id}
              onclick={() =>
                onselect?.({
                  kind: "table-column",
                  analyticId,
                  tableId: table.id,
                  columnId: one.id
                })}
            >
              {one.label}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each table.rows as row, rowIndex (row.id)}
        <tr>
          <th scope="row" class="row-heading">
            <button
              type="button"
              class:selected={selectedKey === row.id}
              aria-label={`Select row ${rowIndex + 1}`}
              aria-pressed={selectedKey === row.id}
              onclick={() =>
                onselect?.({
                  kind: "table-row",
                  analyticId,
                  tableId: table.id,
                  rowId: row.id
                })}
            >
              {rowIndex + 1}
            </button>
          </th>
          {#each row.cells as cell (cell.id)}
            {@const oneColumn = column(cell.columnId)}
            <td>
              <button
                type="button"
                class:selected={selectedKey === cell.id}
                aria-pressed={selectedKey === cell.id}
                onclick={() =>
                  onselect?.({
                    kind: "table-cell",
                    analyticId,
                    tableId: table.id,
                    rowId: row.id,
                    columnId: cell.columnId,
                    cellId: cell.id
                  })}
              >
                {formatAnalyticValue(cell.value, oneColumn?.format)}
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .analytic-table {
    min-width: 0;
    overflow: auto;
    background: var(--token-surface-panel);
  }

  table {
    width: 100%;
    min-width: max-content;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0;
    border-inline-end: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
    text-align: start;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--token-surface-elevated);
  }

  .row-heading {
    position: sticky;
    left: 0;
    width: calc(var(--token-spacing-unit) * 9);
    background: var(--token-surface-elevated);
  }

  button {
    width: 100%;
    min-height: calc(var(--token-spacing-unit) * 7);
    padding-inline: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-primary);
    font: inherit;
    text-align: inherit;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  thead button,
  .row-heading button {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    font-weight: 600;
  }

  td button {
    font-size: var(--token-text-body-sm);
  }

  button:hover {
    background: var(--token-surface-panel-hover);
  }

  button.selected {
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
    outline: 1px solid var(--token-color-active-border);
    outline-offset: -1px;
  }
</style>

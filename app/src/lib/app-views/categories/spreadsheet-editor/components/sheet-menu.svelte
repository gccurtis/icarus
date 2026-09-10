<script lang="ts">
  import * as ContextMenu from "$vendored-components/context-menu";
  import {
    columnLabel,
    gridOf,
    rectLabelOf,
    refAt,
    type Rect
  } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import {
    selectedColumnIds,
    selectedRects,
    selectedRowIds
  } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { columnSignal, rowSignal, type Signal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { merged, mergeOf, unmerged } from "$app-views/categories/spreadsheet-editor/procedures/merge-spans";
  import { frozenColumnsSet } from "$app-views/categories/spreadsheet-editor/procedures/frozen-structure";
  import { insertedColumns, removedColumns } from "$app-views/categories/spreadsheet-editor/procedures/column-structure";
  import { insertedRows, removedRows } from "$app-views/categories/spreadsheet-editor/procedures/row-structure";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  let {
    over,
    row = 0,
    column = 0,
    onsay,
    oncut,
    oncopy,
    onpaste,
    onclear,
    onselectall
  }: {
    /** What the pointer was over when the menu opened. */
    over?: "cell" | "row" | "column" | "corner";
    row?: number;
    column?: number;
    onsay: (text: string) => void;
    oncut: () => void;
    oncopy: () => void;
    onpaste: () => void;
    /** Clearing runs through the same path as the delete key. */
    onclear: () => void;
    onselectall: () => void;
  } = $props();

  const view = workspaceState();
  const register = variableRegister();
  const sheetId = view.active.resourceId;

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));

  const apply = (ops: Edit["ops"]) => {
    if (ops.length > 0 && sheet !== undefined) {
      runtime?.apply(recalculating(register, view.active.resourceId, sheet, ops));
    }
  };

  const perform = (edit: Edit): boolean => {
    if (edit.refused !== undefined) {
      onsay(edit.refused);
      return false;
    }
    apply(edit.ops);
    return true;
  };

  const rows = $derived.by((): number[] => {
    if (over === undefined || over === "corner" || over === "column") return [];
    const chosen = selectedRowIds(view.selection).flatMap((id) => {
      const index = grid.rowAt.get(id);
      return index === undefined ? [] : [index];
    });
    return chosen.includes(row) ? chosen : [row];
  });

  const columns = $derived.by((): number[] => {
    if (over === undefined || over === "corner" || over === "row") return [];
    const chosen = selectedColumnIds(view.selection).flatMap((id) => {
      const index = grid.columnAt.get(id);
      return index === undefined ? [] : [index];
    });
    return chosen.includes(column) ? chosen : [column];
  });

  const rect = $derived.by((): Rect | undefined => {
    const held = selectedRects(grid, view.selection);
    return held.length === 1 && view.selection?.kind === "range" ? held[0] : undefined;
  });

  const anchor = $derived.by(() => {
    if (sheet === undefined || over !== "cell") return undefined;
    const ref = refAt(grid, row, column);
    return ref === undefined ? undefined : mergeOf(sheet, grid, ref);
  });

  const rowWord = (indices: readonly number[]): string =>
    indices.length === 1 ? `row ${indices[0] + 1}` : `${indices.length} rows`;

  const columnWord = (indices: readonly number[]): string =>
    indices.length === 1 ? `column ${columnLabel(indices[0])}` : `${indices.length} columns`;

  const capital = (word: string): string => word.replace(/^\w/, (letter) => letter.toUpperCase());

  const insertRows = (where: "above" | "below") => {
    if (rows.length === 0) return;
    const sorted = [...rows].sort((a, b) => a - b);
    const after =
      where === "above"
        ? sorted[0] === 0
          ? null
          : grid.rows[sorted[0] - 1].id
        : grid.rows[sorted[sorted.length - 1]].id;
    apply(insertedRows(after, sorted.length).ops);
  };

  const insertColumns = (where: "left" | "right") => {
    if (columns.length === 0) return;
    const sorted = [...columns].sort((a, b) => a - b);
    const after =
      where === "left"
        ? sorted[0] === 0
          ? null
          : grid.columns[sorted[0] - 1].id
        : grid.columns[sorted[sorted.length - 1]].id;
    apply(insertedColumns(after, sorted.length).ops);
  };

  const removeRowsHere = () => {
    if (sheet === undefined || rows.length === 0) return;
    if (rows.length >= grid.rows.length) {
      onsay("A sheet keeps at least one row.");
      return;
    }
    apply(removedRows(sheet, grid, rows.map((index) => grid.rows[index].id)));
    view.clear();
  };

  const removeColumnsHere = () => {
    if (sheet === undefined || columns.length === 0) return;
    if (columns.length >= grid.columns.length) {
      onsay("A sheet keeps at least one column.");
      return;
    }
    apply(removedColumns(sheet, grid, columns.map((index) => grid.columns[index].id)));
    view.clear();
  };

  const merge = () => {
    if (sheet === undefined || rect === undefined) return;
    const edit = merged(sheet, grid, rect);
    if (perform(edit) && edit.cleared !== undefined && edit.cleared > 0) {
      onsay(
        `${edit.cleared} ${edit.cleared === 1 ? "cell was" : "cells were"} cleared; ${rectLabelOf(grid, { ...rect, rows: 1, columns: 1 })} keeps its value.`
      );
    }
  };

  const unmerge = () => {
    if (sheet === undefined || anchor === undefined) return;
    perform(unmerged(sheet, anchor.anchor));
  };

  const freezeUpTo = () => {
    if (sheet === undefined || columns.length === 0) return;
    const index = Math.max(...columns) + 1;
    const frozen = sheet.body.frozenColumns ?? 0;
    const op = frozenColumnsSet(sheet.body, frozen === index ? 0 : index);
    if (op !== undefined) apply([op]);
  };

  const openLens = (signal: Signal | undefined) => {
    if (signal !== undefined && isInspectorView(signal.key)) view.inspect(signal.key, signal.selection);
  };
</script>

<ContextMenu.Content class="w-60">
  {#if over === "corner"}
    <ContextMenu.Item onSelect={onselectall}>Select the used range</ContextMenu.Item>
  {:else if over === "cell"}
    <ContextMenu.Item onSelect={oncut}>Cut</ContextMenu.Item>
    <ContextMenu.Item onSelect={oncopy}>Copy</ContextMenu.Item>
    <ContextMenu.Item onSelect={onpaste}>Paste</ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Item onSelect={onclear}>Clear contents</ContextMenu.Item>
    {#if anchor}
      <ContextMenu.Item onSelect={unmerge}>Unmerge {rectLabelOf(grid, anchor.rect)}</ContextMenu.Item>
    {:else if rect && rect.rows * rect.columns > 1}
      <ContextMenu.Item onSelect={merge}>Merge {rectLabelOf(grid, rect)}</ContextMenu.Item>
    {/if}
    <ContextMenu.Separator />
    <ContextMenu.Item onSelect={() => insertRows("above")}>Insert {rowWord(rows)} above</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => insertRows("below")}>Insert {rowWord(rows)} below</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => insertColumns("left")}>Insert {columnWord(columns)} left</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => insertColumns("right")}>Insert {columnWord(columns)} right</ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Item variant="destructive" onSelect={removeRowsHere}>Remove {rowWord(rows)}</ContextMenu.Item>
    <ContextMenu.Item variant="destructive" onSelect={removeColumnsHere}>Remove {columnWord(columns)}</ContextMenu.Item>
  {:else if over === "row"}
    <ContextMenu.Label class="text-caption text-ink-muted px-1.5 py-1 font-normal">
      {capital(rowWord(rows))}
    </ContextMenu.Label>
    <ContextMenu.Item onSelect={() => insertRows("above")}>Insert {rowWord(rows)} above</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => insertRows("below")}>Insert {rowWord(rows)} below</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => openLens(rowSignal(grid, rows))}>Height and more…</ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Item onSelect={onclear}>Clear contents</ContextMenu.Item>
    <ContextMenu.Item variant="destructive" onSelect={removeRowsHere}>Remove {rowWord(rows)}</ContextMenu.Item>
  {:else if over === "column"}
    <ContextMenu.Label class="text-caption text-ink-muted px-1.5 py-1 font-normal">
      {capital(columnWord(columns))}
    </ContextMenu.Label>
    <ContextMenu.Item onSelect={() => insertColumns("left")}>Insert {columnWord(columns)} left</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => insertColumns("right")}>Insert {columnWord(columns)} right</ContextMenu.Item>
    <ContextMenu.Item onSelect={() => openLens(columnSignal(grid, columns))}>Width and more…</ContextMenu.Item>
    <ContextMenu.Item onSelect={freezeUpTo}>
      {(sheet?.body.frozenColumns ?? 0) === Math.max(...columns) + 1
        ? "Unfreeze columns"
        : `Freeze columns up to ${columnLabel(Math.max(...columns))}`}
    </ContextMenu.Item>
    <ContextMenu.Separator />
    <ContextMenu.Item onSelect={onclear}>Clear contents</ContextMenu.Item>
    <ContextMenu.Item variant="destructive" onSelect={removeColumnsHere}>Remove {columnWord(columns)}</ContextMenu.Item>
  {/if}
</ContextMenu.Content>

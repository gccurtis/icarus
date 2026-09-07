import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  keyOf,
  refAt,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { cleared, expressed, written } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import {
  isAnchor,
  mergeSpans,
  spanCovering,
  spillSpans,
  type Edit
} from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { insertedColumns, insertedRows } from "$app-views/categories/spreadsheet-editor/procedures/structure";
import { parseTyped } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Pasted = Edit & { readonly summary?: string };

type Target = { readonly row: number; readonly column: number; readonly text: string };

const targetsOf = (
  at: { readonly row: number; readonly column: number },
  values: readonly (readonly string[])[],
  selection: Rect | undefined
): Target[] => {
  const single = values.length === 1 && values[0].length === 1;
  if (single && selection !== undefined && selection.rows * selection.columns > 1) {
    const text = values[0][0];
    const targets: Target[] = [];
    for (let row = selection.row; row < selection.row + selection.rows; row += 1) {
      for (let column = selection.column; column < selection.column + selection.columns; column += 1) {
        targets.push({ row, column, text });
      }
    }
    return targets;
  }
  return values.flatMap((line, rowOffset) =>
    line.map((text, columnOffset) => ({ row: at.row + rowOffset, column: at.column + columnOffset, text }))
  );
};

export const pasted = (
  sheet: LiveSheet,
  grid: Grid,
  at: { readonly row: number; readonly column: number },
  values: readonly (readonly string[])[],
  selection?: Rect
): Pasted => {
  const targets = targetsOf(at, values, selection);
  if (targets.length === 0) return { ops: [] };

  const spills = spillSpans(sheet, grid);
  const merges = mergeSpans(sheet, grid);
  for (const target of targets) {
    const spill = spanCovering(spills, target.row, target.column);
    if (spill !== undefined && !isAnchor(spill, target.row, target.column)) {
      return { ops: [], refused: "Paste over a spill is refused. Nothing was written." };
    }
    const merge = spanCovering(merges, target.row, target.column);
    if (merge !== undefined && !isAnchor(merge, target.row, target.column)) {
      return { ops: [], refused: "Paste over a merge is refused. Nothing was written." };
    }
  }

  const ops: SpreadsheetOp[] = [];
  const lastRow = Math.max(...targets.map((target) => target.row));
  const lastColumn = Math.max(...targets.map((target) => target.column));
  const rowIds = grid.rows.map((row) => row.id);
  const columnIds = grid.columns.map((column) => column.id);

  if (lastRow >= rowIds.length) {
    const made = insertedRows(rowIds[rowIds.length - 1] ?? null, lastRow - rowIds.length + 1);
    ops.push(...made.ops);
    rowIds.push(...made.ids);
  }
  if (lastColumn >= columnIds.length) {
    const made = insertedColumns(columnIds[columnIds.length - 1] ?? null, lastColumn - columnIds.length + 1);
    ops.push(...made.ops);
    columnIds.push(...made.ids);
  }

  let clearedCount = 0;
  for (const target of targets) {
    const ref: CellRef = { rowId: rowIds[target.row], columnId: columnIds[target.column] };
    const parsed = parseTyped(target.text);
    if (parsed.kind === "clear") {
      if (refAt(grid, target.row, target.column) !== undefined && sheet.cells[keyOf(ref)] !== undefined) {
        const edit = cleared(sheet, grid, [ref]);
        ops.push(...edit.ops);
        clearedCount += edit.cleared ?? 0;
      }
      continue;
    }
    if (parsed.kind === "expression") {
      ops.push(...expressed(sheet, ref, parsed.expression));
      continue;
    }
    ops.push(...written(sheet, ref, parsed.value));
  }

  const grown = lastRow >= grid.rows.length || lastColumn >= grid.columns.length;
  const shape = selection !== undefined && values.length === 1 && values[0].length === 1 && targets.length > 1
    ? `${targets.length} cells`
    : `${values.length} × ${Math.max(...values.map((line) => line.length))}`;
  return {
    ops,
    cleared: clearedCount,
    summary: `Pasted ${shape}${grown ? " · the grid grew to fit" : ""}`
  };
};

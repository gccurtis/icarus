import type {
  SurfaceEdit,
  SurfaceFill,
  SurfacePaste,
  SurfaceSelection
} from "$authored-components/sheet-surface";
import { refAt, refsIn, type Rect } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { cleared, typed, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import { pasted } from "$app-views/categories/spreadsheet-editor/procedures/clipboard";
import { insertedColumns, movedColumn } from "$app-views/categories/spreadsheet-editor/procedures/column-structure";
import { filled } from "$app-views/categories/spreadsheet-editor/procedures/fill";
import { recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { insertedRows, movedRow } from "$app-views/categories/spreadsheet-editor/procedures/row-structure";
import type { SheetActionContext } from "$app-views/categories/spreadsheet-editor/procedures/sheet-action-context";
import { selectedRects } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
import { APPEND_COLUMNS, APPEND_ROWS } from "$app-views/categories/spreadsheet-editor/procedures/structure";
import { resizedColumn, resizedRow } from "$app-views/categories/spreadsheet-editor/procedures/track-sizing";

export type SheetEditActions = {
  readonly say: (text: string) => void;
  readonly apply: (ops: Edit["ops"]) => void;
  readonly perform: (edit: Edit) => boolean;
  readonly edited: (edits: readonly SurfaceEdit[]) => void;
  readonly deleted: (selection: SurfaceSelection) => void;
  readonly fill: (wanted: SurfaceFill) => void;
  readonly paste: (wanted: SurfacePaste) => void;
  readonly resize: (column: number, size: number) => void;
  readonly resizeRow: (row: number, size: number) => void;
  readonly moveColumn: (from: number, to: number) => void;
  readonly moveRow: (from: number, to: number) => void;
  readonly append: () => void;
  readonly appendColumn: () => void;
  readonly clearSelection: () => void;
};

export const createSheetEditActions = (context: SheetActionContext): SheetEditActions => {
  const say = (text: string) => {
    context.held.notice = text;
    if (context.held.noticeTimer !== undefined) clearTimeout(context.held.noticeTimer);
    context.held.noticeTimer = setTimeout(() => (context.held.notice = undefined), 6000);
  };

  const apply = (ops: Edit["ops"]) => {
    const sheet = context.sheet;
    if (ops.length === 0 || sheet === undefined) return;
    context.runtime?.apply(recalculating(context.register, context.sheetId, sheet, ops));
  };

  const perform = (edit: Edit): boolean => {
    if (edit.refused !== undefined) {
      say(edit.refused);
      return false;
    }
    apply(edit.ops);
    if (edit.skipped !== undefined && edit.skipped > 0) {
      say(
        `${edit.skipped} ${edit.skipped === 1
          ? "cell under a spill or a merge was"
          : "cells under a spill or a merge were"} left alone.`
      );
    }
    return true;
  };

  const rectsOf = (held: SurfaceSelection): Rect[] => [
    ...held.ranges,
    ...held.rows.map((row) => ({ row, column: 0, rows: 1, columns: context.grid.columns.length })),
    ...held.columns.map((column) => ({ row: 0, column, rows: context.grid.rows.length, columns: 1 }))
  ];

  const deleted = (selection: SurfaceSelection) => {
    const sheet = context.sheet;
    if (sheet === undefined) return;
    const refs = rectsOf(selection).flatMap((rect) => refsIn(context.grid, rect));
    perform(cleared(sheet, context.grid, refs));
  };

  return {
    say,
    apply,
    perform,
    edited: (edits) => {
      const sheet = context.sheet;
      if (sheet === undefined) return;
      for (const edit of edits) {
        const ref = refAt(context.grid, edit.row, edit.column);
        if (ref !== undefined) perform(typed(sheet, context.grid, ref, edit.text, context.facts));
      }
    },
    deleted,
    fill: (wanted) => {
      const sheet = context.sheet;
      if (sheet === undefined) return;
      const edit = filled(sheet, context.grid, wanted.source, wanted.target);
      if (perform(edit) && edit.summary !== undefined) say(edit.summary);
    },
    paste: (wanted) => {
      const sheet = context.sheet;
      if (sheet === undefined) return;
      const [rect] = selectedRects(context.grid, context.view.selection);
      const edit = pasted(sheet, context.grid, wanted, wanted.values, context.facts, rect);
      if (perform(edit) && edit.summary !== undefined) say(edit.summary);
    },
    resize: (column, size) => {
      const id = context.grid.columns[column]?.id;
      if (id === undefined) return;
      const op = resizedColumn(context.grid, id, size);
      if (op !== undefined) apply([op]);
    },
    resizeRow: (row, size) => {
      const id = context.grid.rows[row]?.id;
      if (id === undefined) return;
      const op = resizedRow(context.grid, id, size);
      if (op !== undefined) apply([op]);
    },
    moveColumn: (from, to) => {
      const op = movedColumn(context.grid, from, to);
      if (op !== undefined) apply([op]);
    },
    moveRow: (from, to) => {
      const op = movedRow(context.grid, from, to);
      if (op !== undefined) apply([op]);
    },
    append: () => apply(insertedRows(context.grid.rows.at(-1)?.id ?? null, APPEND_ROWS).ops),
    appendColumn: () => apply(insertedColumns(context.grid.columns.at(-1)?.id ?? null, APPEND_COLUMNS).ops),
    clearSelection: () => {
      if (context.selection !== undefined) deleted(context.selection);
    }
  };
};

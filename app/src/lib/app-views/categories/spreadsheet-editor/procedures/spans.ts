import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  contains,
  indexOf,
  rectOf,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";

export type Span = { readonly anchor: CellRef; readonly rect: Rect };

export type Edit = {
  readonly ops: readonly SpreadsheetOp[];
  readonly refused?: string;
  readonly skipped?: number;
  readonly cleared?: number;
};

export const spansOf = (sheet: LiveSheet, grid: Grid, field: "mergedTo" | "spillTo"): Span[] =>
  Object.values(sheet.cells).flatMap((cell) => {
    const far = cell[field];
    if (far === undefined) return [];
    const anchor = { rowId: cell.rowId, columnId: cell.columnId };
    const rect = rectOf(grid, { from: anchor, to: far });
    return rect === undefined ? [] : [{ anchor, rect }];
  });

export const spanCovering = (spans: readonly Span[], row: number, column: number): Span | undefined =>
  spans.find((span) => contains(span.rect, row, column));

export const isAnchor = (span: Span, row: number, column: number): boolean =>
  span.rect.row === row && span.rect.column === column;

export const childSpanOf = (
  spans: readonly Span[],
  grid: Grid,
  ref: CellRef
): Span | undefined => {
  const at = indexOf(grid, ref);
  if (at === undefined) return undefined;
  const span = spanCovering(spans, at.row, at.column);
  return span === undefined || isAnchor(span, at.row, at.column) ? undefined : span;
};

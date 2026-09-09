import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  keyOf,
  refsIn,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { setField } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import { paintOf, type CellFormat, type Paint } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { ruleFormatOver } from "$app-views/categories/spreadsheet-editor/procedures/styles";

/** How every cell under the selection is painted, one entry per cell. */
export const paintsOf = (
  sheet: LiveSheet | undefined,
  grid: Grid,
  rects: readonly Rect[]
): Paint[] =>
  sheet === undefined
    ? []
    : rects.flatMap((rect) =>
        refsIn(grid, rect).map((at) => paintOf(sheet.body, grid, at, sheet.cells[keyOf(at)]))
      );

/** What the cells under the selection agree on, or nothing when they disagree. */
export const sharedOf = <T>(
  paints: readonly Paint[],
  pick: (paint: Paint) => T
): { value: T | undefined; mixed: boolean } => {
  const values = [...new Set(paints.map((paint) => JSON.stringify(pick(paint) ?? null)))];
  return {
    value: values.length === 1 ? (JSON.parse(values[0]) as T) : undefined,
    mixed: values.length > 1
  };
};

/**
 * Writing one field of the format.
 *
 * One cell carries its own override; anything wider is a rule over the corners,
 * which is what keeps a sheet's formatting regional rather than per cell.
 */
export const formatOps = (
  sheet: LiveSheet,
  grid: Grid,
  rects: readonly Rect[],
  ref: CellRef | undefined,
  field: keyof CellFormat,
  value: unknown
): readonly SpreadsheetOp[] =>
  ref !== undefined && sheet.cells[keyOf(ref)] !== undefined
    ? [setField(sheet, ref, `format/${field}`, value)]
    : ruleFormatOver(sheet.body, grid, rects, field, value);

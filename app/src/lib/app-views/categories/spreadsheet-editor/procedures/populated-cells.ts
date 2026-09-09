import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  keyOf,
  refsIn,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";

export const populatedIn = (sheet: LiveSheet, grid: Grid, rect: Rect): SheetCell[] =>
  refsIn(grid, rect).flatMap((ref) => {
    const held = sheet.cells[keyOf(ref)];
    return held === undefined ? [] : [held];
  });

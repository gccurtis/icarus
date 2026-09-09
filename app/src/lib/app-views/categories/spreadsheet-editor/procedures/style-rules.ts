import type { FormatRule, SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import {
  contains,
  rectOf,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";

export const rulesOverRects = (
  body: SpreadsheetBody,
  grid: Grid,
  rects: readonly Rect[]
): FormatRule[] =>
  body.formatRules.filter((rule) => {
    const held = rectOf(grid, rule);
    return (
      held !== undefined &&
      rects.some((rect) => {
        for (let row = rect.row; row < rect.row + rect.rows; row += 1) {
          for (let column = rect.column; column < rect.column + rect.columns; column += 1) {
            if (contains(held, row, column)) return true;
          }
        }
        return false;
      })
    );
  });

import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  keyOf,
  labelOf,
  rangeOf,
  rectOf,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  childSpanOf,
  spansOf,
  type Span
} from "$app-views/categories/spreadsheet-editor/procedures/spans";

export const spillSpans = (sheet: LiveSheet, grid: Grid): Span[] =>
  spansOf(sheet, grid, "spillTo");

export const spillChildOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined =>
  childSpanOf(spillSpans(sheet, grid), grid, ref);

export const spillOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined => {
  const held = sheet.cells[keyOf(ref)];
  if (held?.spillTo === undefined) return undefined;
  const rect = rectOf(grid, { from: ref, to: held.spillTo });
  return rect === undefined ? undefined : { anchor: ref, rect };
};

export const spillMessage = (
  grid: Grid,
  ref: CellRef,
  span: Span,
  expression: string | undefined
): string =>
  `${labelOf(grid, ref)} is filled by ${labelOf(grid, span.anchor)}${
    expression === undefined ? "" : `, whose ${expression} spills to ${rectLabel(grid, span)}`
  }. Edit ${labelOf(grid, span.anchor)} to change it.`;

const rectLabel = (grid: Grid, span: Span): string => {
  const far = rangeOf(grid, span.rect);
  return far === undefined ? "?" : labelOf(grid, far.to);
};

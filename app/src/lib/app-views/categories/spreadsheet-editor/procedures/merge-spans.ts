import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  contains,
  indexOf,
  keyOf,
  rangeOf,
  rectOf,
  refsIn,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  childSpanOf,
  spansOf,
  type Edit,
  type Span
} from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { spillSpans } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";

export const mergeSpans = (sheet: LiveSheet, grid: Grid): Span[] =>
  spansOf(sheet, grid, "mergedTo");

export const mergeCoveredOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined =>
  childSpanOf(mergeSpans(sheet, grid), grid, ref);

/** The merge a whole rectangle sits inside, if it sits inside one. */
export const mergeAround = (sheet: LiveSheet, grid: Grid, rect: Rect): Span | undefined =>
  mergeSpans(sheet, grid).find(
    (span) =>
      contains(span.rect, rect.row, rect.column) &&
      contains(span.rect, rect.row + rect.rows - 1, rect.column + rect.columns - 1)
  );

export const mergeOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined => {
  const held = sheet.cells[keyOf(ref)];
  if (held?.mergedTo === undefined) return undefined;
  const rect = rectOf(grid, { from: ref, to: held.mergedTo });
  return rect === undefined ? undefined : { anchor: ref, rect };
};

export const merged = (sheet: LiveSheet, grid: Grid, rect: Rect): Edit => {
  if (rect.rows * rect.columns < 2) return { ops: [], refused: "Merge needs more than one cell." };
  const range = rangeOf(grid, rect);
  if (range === undefined) return { ops: [], refused: "That range is off the grid." };

  const taken = [...mergeSpans(sheet, grid), ...spillSpans(sheet, grid)].some((span) =>
    refsIn(grid, rect).some((ref) => {
      const at = indexOf(grid, ref);
      return at !== undefined && contains(span.rect, at.row, at.column);
    })
  );
  if (taken) return { ops: [], refused: "That range already holds a merge or a spill." };

  const anchorKey = keyOf(range.from);
  const anchor = sheet.cells[anchorKey];
  const ops: SpreadsheetOp[] = [];
  let cleared = 0;
  for (const ref of refsIn(grid, rect)) {
    const key = keyOf(ref);
    if (key === anchorKey) continue;
    const held = sheet.cells[key];
    if (held === undefined) continue;
    ops.push({ op: "set", target: "cell", path: key, value: null, was: held });
    cleared += 1;
  }
  ops.push(
    anchor === undefined
      ? {
          op: "set",
          target: "cell",
          path: anchorKey,
          value: { value: { kind: "empty" }, mergedTo: range.to },
          was: null
        }
      : {
          op: "set",
          target: "cell",
          path: `${anchorKey}/mergedTo`,
          value: range.to,
          was: anchor.mergedTo ?? null
        }
  );
  return { ops, cleared };
};

export const unmerged = (sheet: LiveSheet, anchor: CellRef): Edit => {
  const key = keyOf(anchor);
  const held = sheet.cells[key];
  if (held?.mergedTo === undefined) return { ops: [] };
  return {
    ops: [{ op: "set", target: "cell", path: `${key}/mergedTo`, value: null, was: held.mergedTo }]
  };
};

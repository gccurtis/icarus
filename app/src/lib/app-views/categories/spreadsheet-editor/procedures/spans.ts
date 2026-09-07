import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  contains,
  indexOf,
  keyOf,
  labelOf,
  rangeOf,
  rectOf,
  refsIn,
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

const spansOf = (sheet: LiveSheet, grid: Grid, field: "mergedTo" | "spillTo"): Span[] =>
  Object.values(sheet.cells).flatMap((cell) => {
    const far = cell[field];
    if (far === undefined) return [];
    const anchor = { rowId: cell.rowId, columnId: cell.columnId };
    const rect = rectOf(grid, { from: anchor, to: far });
    return rect === undefined ? [] : [{ anchor, rect }];
  });

export const mergeSpans = (sheet: LiveSheet, grid: Grid): Span[] => spansOf(sheet, grid, "mergedTo");

export const spillSpans = (sheet: LiveSheet, grid: Grid): Span[] => spansOf(sheet, grid, "spillTo");

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

export const spillChildOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined =>
  childSpanOf(spillSpans(sheet, grid), grid, ref);

export const mergeCoveredOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined =>
  childSpanOf(mergeSpans(sheet, grid), grid, ref);

export const mergeOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined => {
  const held = sheet.cells[keyOf(ref)];
  if (held?.mergedTo === undefined) return undefined;
  const rect = rectOf(grid, { from: ref, to: held.mergedTo });
  return rect === undefined ? undefined : { anchor: ref, rect };
};

export const spillOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Span | undefined => {
  const held = sheet.cells[keyOf(ref)];
  if (held?.spillTo === undefined) return undefined;
  const rect = rectOf(grid, { from: ref, to: held.spillTo });
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

export const spillMessage = (grid: Grid, ref: CellRef, span: Span, expression: string | undefined): string =>
  `${labelOf(grid, ref)} is filled by ${labelOf(grid, span.anchor)}${
    expression === undefined ? "" : `, whose ${expression} spills to ${rectLabel(grid, span)}`
  }. Edit ${labelOf(grid, span.anchor)} to change it.`;

const rectLabel = (grid: Grid, span: Span): string => {
  const far = rangeOf(grid, span.rect);
  return far === undefined ? "?" : labelOf(grid, far.to);
};

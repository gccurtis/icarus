export {
  cellsIn,
  clamped,
  columnIndexOf,
  columnLabel,
  contains,
  emptyGrid,
  gridOf,
  indexOf,
  keyOf,
  labelOf,
  overlaps,
  parseRange,
  parseRef,
  rangeLabelOf,
  rangeOf,
  rectKeyOf,
  rectLabelOf,
  rectOf,
  rectOfKey,
  refAt,
  refOfKey,
  refsIn,
  sameRect,
  sameRef
} from "$representation/data/behavior/spreadsheets/addressing";

export type { Grid, Rect } from "$representation/data/behavior/spreadsheets/addressing";

export type { CellRange, CellRef } from "$representation/data/types/content/formula-value";
export type {
  GridColumn,
  GridRow,
  SpreadsheetBody
} from "$representation/data/types/spreadsheets/body";
export type { LiveSheet } from "$representation/data/types/spreadsheets/live";
export type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

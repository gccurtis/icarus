import type { Id } from "$representation/data/types/core/id";

/**
 * A date as parts, because each is separately meaningful — a formula can ask for
 * the month. `utc` is derived from the components and kept for sorting.
 */
export type DateValue = {
  calendar: "gregorian";
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  timeZone?: string;
  utc: number;
};

/** A returned table's columns are typed independently; one `valueFormat` cannot say that. */
export type FormulaColumn = { name?: string; valueFormat?: string };

/**
 * One cell, by the ids of its row and column — never `"B7"`. Those ids name
 * entries in the sheet's body, so they survive a row being inserted above.
 */
export type CellRef = { rowId: string; columnId: string };

/** A pair of corners. What lies between them is whatever currently lies between them. */
export type CellRange = { from: CellRef; to: CellRef };

/**
 * What a computation produced, or refers to.
 *
 * `empty` is not a zero, a blank, or a `false` — collapsing them is how a sum
 * counts a gap as a value. There is no `error` kind: a failure lives in the
 * holder's `state`.
 *
 * `range` is the one member that is a reference rather than a result: it has to
 * be resolved before it renders.
 */
export type FormulaValue =
  | { kind: "empty" }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "logic"; value: boolean }
  | { kind: "date"; value: DateValue }
  | { kind: "list"; values: FormulaValue[] }
  | { kind: "record"; fields: Record<string, FormulaValue> }
  | { kind: "table"; columns: FormulaColumn[]; rows: FormulaValue[][] }
  | ({ kind: "range"; resourceId: Id<"spreadsheets"> } & CellRange)
  | { kind: "function"; parameters: string[]; formulaId: Id<"formulas"> };

import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

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
 * What a name points at. Not a copy: it resolves when it is asked for, walking
 * on until it reaches something that is not a reference.
 */
export type ReferenceTarget =
  | { to: "variable"; name: string }
  | { to: "resource"; ref: ResourceRef };

/**
 * What a computation produced, or points at.
 *
 * `empty` is not a zero, a blank, or a `false` — collapsing them is how a sum
 * counts a gap as a value. There is no `error` kind: a failure lives in the
 * holder's `state`.
 *
 * `reference` is a pointer and its own kind, rather than a table whose values
 * happen to be tables. `range` is an address in a sheet, written by whoever owns
 * those cells and resolved before it renders; the two are not the same idea.
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
  | { kind: "reference"; target: ReferenceTarget }
  | ({ kind: "range"; resourceId: Id<"spreadsheets"> } & CellRange)
  | { kind: "function"; parameters: string[]; formulaId: Id<"formulas"> };

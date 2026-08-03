// FormulaValue algebra — exactly eight kinds, no implicit coercion.
// LambdaFunction.body is FormulaNode (imported from ast.ts).

import type { FormulaNode, BoundFormulaReference } from "./ast.js";
import type { CanonicalRational } from "./rational.js";

// ─── Value kinds ─────────────────────────────────────────────────────────────

export interface NullValue {
  readonly kind: "null";
}

export interface NumberValue {
  readonly kind: "number";
  readonly value: CanonicalRational;
}

export interface TextValue {
  readonly kind: "text";
  readonly value: string;
}

export interface LogicValue {
  readonly kind: "logic";
  readonly value: boolean;
}

export interface FormulaTable {
  readonly fields: readonly string[];
  readonly rows: readonly (readonly FormulaValue[])[];
}

export interface ListValue {
  readonly kind: "list";
  readonly table: FormulaTable;
}

export interface RecordValue {
  readonly kind: "record";
  readonly table: FormulaTable;
}

/**
 * Rendering intent a table may carry. A display IS its table — every table
 * operation still applies, and a consumer that does not render simply ignores
 * this. See the DISPLAY builtin.
 */
export type DisplayKind = "table" | "bar" | "line" | "area" | "scatter" | "pie";

export const DISPLAY_KINDS: readonly DisplayKind[] = [
  "table",
  "bar",
  "line",
  "area",
  "scatter",
  "pie"
];

export function isDisplayKind(value: string): value is DisplayKind {
  return (DISPLAY_KINDS as readonly string[]).includes(value);
}

export interface TableValue {
  readonly kind: "table";
  readonly table: FormulaTable;
  /** Present only when DISPLAY set it. Absent tables render however the caller likes. */
  readonly display?: DisplayKind;
}

export interface FunctionValue {
  readonly kind: "function";
  readonly fn: FormulaFunction;
}

export type FormulaValue =
  | NullValue
  | NumberValue
  | TextValue
  | LogicValue
  | ListValue
  | RecordValue
  | TableValue
  | FunctionValue;

// ─── Function values ──────────────────────────────────────────────────────────

export interface BuiltinFunction {
  readonly kind: "builtin";
  readonly name: string;
  readonly implementationVersion: string;
}

export interface CapturedLexicalBinding {
  readonly name: string;
  readonly value: FormulaValue;
  readonly reference?: BoundFormulaReference;
}

export interface LambdaFunction {
  readonly kind: "lambda";
  readonly parameters: readonly string[];
  readonly body: FormulaNode;
  readonly normalizedSource: string;
  readonly capturedBindings: readonly CapturedLexicalBinding[];
  readonly identityDigest: string;
}

export type FormulaFunction = BuiltinFunction | LambdaFunction;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const NULL_VALUE: NullValue = { kind: "null" };

export function makeNumber(r: CanonicalRational): NumberValue {
  return { kind: "number", value: r };
}

export function makeText(s: string): TextValue {
  return { kind: "text", value: s };
}

export function makeLogic(b: boolean): LogicValue {
  return { kind: "logic", value: b };
}

/** Build a ListValue — one field named "value", arbitrary rows. */
export function makeList(elements: FormulaValue[]): ListValue {
  return {
    kind: "list",
    table: {
      fields: ["value"],
      rows: elements.map(e => [e])
    }
  };
}

/** Build a RecordValue — exactly one row. */
export function makeRecord(fields: string[], values: FormulaValue[]): RecordValue {
  if (fields.length !== values.length) throw new Error("record: field/value length mismatch");
  return { kind: "record", table: { fields, rows: [values] } };
}

/** Build a TableValue, optionally carrying rendering intent. */
export function makeTable(
  fields: string[],
  rows: FormulaValue[][],
  display?: DisplayKind
): TableValue {
  for (const row of rows) {
    if (row.length !== fields.length) throw new Error("table: row length mismatch");
  }
  const table = { fields, rows };
  return display === undefined ? { kind: "table", table } : { kind: "table", table, display };
}

export const EMPTY_TABLE: TableValue = { kind: "table", table: { fields: [], rows: [] } };
export const TRUE_VALUE: LogicValue = { kind: "logic", value: true };
export const FALSE_VALUE: LogicValue = { kind: "logic", value: false };

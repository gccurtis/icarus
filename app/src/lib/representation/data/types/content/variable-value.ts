import type { FormulaValue } from "$representation/data/types/content/formula-value";

/**
 * What a name holds.
 *
 * The same list a formula can answer with, references included. It was once
 * `FormulaValue` plus a reference, back when only a name could hold a pointer;
 * a reference is a value kind now, so the two lists are one and this name says
 * which side of the question is being asked rather than which shapes are legal.
 */
export type VariableValue = FormulaValue;

/** What a variable is allowed to hold, declared rather than derived. */
export type VariableType =
  | "any"
  | "number"
  | "text"
  | "logic"
  | "date"
  | "list"
  | "record"
  | "table"
  | "reference"
  | "range"
  | "function";

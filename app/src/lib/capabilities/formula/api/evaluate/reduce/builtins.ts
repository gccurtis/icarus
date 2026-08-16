import type { FormulaValue } from "$content/types/value";
import { FormulaError } from "$formula/errors";

const EMPTY: FormulaValue = { kind: "empty" };

/** A table argument is its cells: `SUM(A1:A3, 2)` sums four things, not two. */
const cellsOf = (args: FormulaValue[]): FormulaValue[] =>
  args.flatMap((arg) => (arg.kind === "table" ? arg.rows.flat() : [arg]));

/**
 * The numbers among the arguments.
 *
 * **A blank is skipped and text is refused.** Skipping the blank is what stops
 * an average over a column with a gap in it from dividing by a row that holds
 * nothing; refusing the text is the other half — passing silently over a value
 * that is there is the same quiet wrongness in the other direction.
 */
const numbersOf = (args: FormulaValue[]): number[] =>
  cellsOf(args)
    .filter((cell) => cell.kind !== "empty")
    .map((cell) => {
      if (cell.kind !== "number") {
        throw new FormulaError("type-mismatch", `Expected a number, got ${cell.kind}`);
      }
      return cell.value;
    });

/** Nothing aggregated is not zero — the sum of nothing is nothing. */
const over = (args: FormulaValue[], fold: (numbers: number[]) => number): FormulaValue => {
  const numbers = numbersOf(args);
  return numbers.length === 0 ? EMPTY : { kind: "number", value: fold(numbers) };
};

export type Builtin = (args: FormulaValue[]) => FormulaValue;

/**
 * Everything a formula can call in pass 2.
 *
 * The relational builtins an analysis compiles to — `JOIN`, `WHERE`, `GROUP`,
 * `AGGREGATE`, `SORT` — arrive with analyses in pass 8. Half-building them here
 * would fix their semantics before the capability that defines them exists.
 */
export const BUILTINS: Readonly<Record<string, Builtin>> = {
  SUM: (args) => over(args, (numbers) => numbers.reduce((total, n) => total + n, 0)),
  AVERAGE: (args) =>
    over(args, (numbers) => numbers.reduce((total, n) => total + n, 0) / numbers.length),
  MIN: (args) => over(args, (numbers) => Math.min(...numbers)),
  MAX: (args) => over(args, (numbers) => Math.max(...numbers)),
  // The one aggregate defined on nothing: a count of no values is zero, and it
  // counts anything present rather than only what arithmetic could use.
  COUNT: (args) => ({
    kind: "number",
    value: cellsOf(args).filter((cell) => cell.kind !== "empty").length
  })
};

export const isBuiltin = (name: string): boolean => Object.hasOwn(BUILTINS, name.toUpperCase());

import type { Scope } from "$access/types/access";
import type { FormulaValue } from "$content/types/value";
import type { QueryCtx } from "$convex/_generated/server";
import { apply, negate } from "$formula/api/evaluate/reduce/arithmetic";
import { BUILTINS, isBuiltin } from "$formula/api/evaluate/reduce/builtins";
import { FormulaError } from "$formula/errors";
import type { Cells } from "$formula/types/evaluation";
import type { Expression } from "$formula/types/expression";
import { findVariable } from "$name-manager/api/shared/find-variable";
import { asTable } from "$name-manager/types/table";
import type { NameVariable } from "$name-manager/types/variable";

const EMPTY: FormulaValue = { kind: "empty" };

/** `A` is 1 and `AA` is 27 — a base-26 number written with letters. */
const columnNumber = (letters: string): number =>
  [...letters].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0);

const columnLetters = (index: number): string => {
  let letters = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

const addressParts = (reference: string) => {
  const [, letters, digits] = /^([A-Z]+)([0-9]+)$/.exec(reference)!;
  return { column: columnNumber(letters), row: Number(digits) };
};

/**
 * A range as a table — one column per letter, one row per number.
 *
 * Written backwards it means the same range: `A2:A1` is what a person gets by
 * dragging upwards, and refusing it would be pedantry about a gesture.
 */
const rangeValue = (from: string, to: string, cells: Cells): FormulaValue => {
  const start = addressParts(from);
  const end = addressParts(to);
  const columns = [Math.min(start.column, end.column), Math.max(start.column, end.column)];
  const rows = [Math.min(start.row, end.row), Math.max(start.row, end.row)];

  const letters = [];
  for (let column = columns[0]; column <= columns[1]; column += 1) {
    letters.push(columnLetters(column));
  }

  const grid = [];
  for (let row = rows[0]; row <= rows[1]; row += 1) {
    grid.push(letters.map((letter) => cells[`${letter}${row}`] ?? EMPTY));
  }

  return { kind: "table", columns: letters.map((name) => ({ name })), rows: grid };
};

/**
 * What a named variable is worth inside an expression.
 *
 * A list or a record arrives as a table, through the name manager's own
 * projection — so `SUM(Quarters)` works whether `Quarters` was declared a list
 * or a table, which is the point of that projection. A function refuses here
 * rather than there, because a refusal a formula states has to be a
 * `FormulaError` to become a failed computation instead of a server fault.
 */
const valueOf = (variable: NameVariable): FormulaValue => {
  const value = variable.value;
  if (value.kind === "function") {
    throw new FormulaError("type-mismatch", `'${variable.name}' is a function, not a value`);
  }
  if (value.kind === "list" || value.kind === "record") return asTable(variable.name, value);
  return value;
};

/**
 * An expression tree to a value.
 *
 * **This is the only direction the dependency runs**: a bare name that is not a
 * builtin is asked of the name manager, and the name manager asks nothing of
 * formula. Anything else would be a cycle between a store and an evaluator.
 */
export const reduce = async (
  ctx: QueryCtx,
  scope: Scope,
  node: Expression,
  cells: Cells
): Promise<FormulaValue> => {
  switch (node.kind) {
    case "number":
    case "text":
    case "boolean":
      return { kind: node.kind, value: node.value } as FormulaValue;

    case "cell":
      return cells[node.reference] ?? EMPTY;

    case "range":
      return rangeValue(node.from, node.to, cells);

    case "name": {
      const variable = await findVariable(ctx, scope, node.name);
      if (!variable) {
        throw new FormulaError("unknown-name", `Nothing named '${node.name}'`);
      }
      return valueOf(variable);
    }

    case "call": {
      if (!isBuiltin(node.name)) {
        throw new FormulaError("unknown-function", `No function named '${node.name}'`);
      }
      const args = [];
      for (const argument of node.arguments) {
        args.push(await reduce(ctx, scope, argument, cells));
      }
      return BUILTINS[node.name.toUpperCase()](args);
    }

    case "unary":
      return negate(await reduce(ctx, scope, node.operand, cells));

    case "binary":
      return apply(
        node.operator,
        await reduce(ctx, scope, node.left, cells),
        await reduce(ctx, scope, node.right, cells)
      );
  }
};

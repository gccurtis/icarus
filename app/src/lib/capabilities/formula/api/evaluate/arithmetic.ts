import type { FormulaValue } from "$content/types/value";
import { FormulaError } from "$formula/errors";
import type { Operator } from "$formula/types/expression";

/**
 * The number an operand is, or a refusal.
 *
 * **`empty` refuses rather than coercing to zero.** A blank cell is not a zero,
 * and `=A1*2` answering `0` for a cell nobody has filled in reads exactly like
 * an answer. Refusing makes the gap visible, which is the whole reason `empty`
 * is a kind of its own.
 */
const asNumber = (value: FormulaValue): number => {
  if (value.kind === "empty") {
    throw new FormulaError("empty-operand", "That cell is blank, which is not a zero");
  }
  if (value.kind !== "number") {
    throw new FormulaError("type-mismatch", `Expected a number, got ${value.kind}`);
  }
  return value.value;
};

/** One arithmetic operator over two values. */
export const apply = (
  operator: Operator,
  left: FormulaValue,
  right: FormulaValue
): FormulaValue => {
  const a = asNumber(left);
  const b = asNumber(right);

  switch (operator) {
    case "+":
      return { kind: "number", value: a + b };
    case "-":
      return { kind: "number", value: a - b };
    case "*":
      return { kind: "number", value: a * b };
    case "/":
      // Not Infinity: a division by zero is a mistake in the expression, and a
      // value that renders as `∞` is one nobody can act on.
      if (b === 0) throw new FormulaError("division-by-zero", "Division by zero");
      return { kind: "number", value: a / b };
    case "^":
      return { kind: "number", value: a ** b };
  }
};

export const negate = (value: FormulaValue): FormulaValue => ({
  kind: "number",
  value: -asNumber(value)
});

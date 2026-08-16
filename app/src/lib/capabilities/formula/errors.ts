import { ConvexError } from "convex/values";

export type FormulaErrorCode =
  | "syntax"
  | "unknown-name"
  | "unknown-function"
  | "type-mismatch"
  | "empty-operand"
  | "division-by-zero";

export type FormulaRefusal = {
  readonly capability: "formula";
  readonly code: FormulaErrorCode;
  readonly message: string;
};

/**
 * A formula that cannot be computed, thrown from wherever notices.
 *
 * `evaluate` catches exactly this and returns `state: "error"` with the message,
 * which is how a failure reaches a block: an error is a property of the
 * computation, never a `FormulaValue`. Anything else thrown is a fault and
 * propagates — the same refusal/fault line Convex draws at the wire, drawn again
 * inside one function so that only stated failures become results.
 */
export class FormulaError extends ConvexError<FormulaRefusal> {
  constructor(code: FormulaErrorCode, message: string) {
    super({ capability: "formula", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const formulaRefusal = (error: unknown): FormulaRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as FormulaRefusal).capability === "formula"
    ? (data as FormulaRefusal)
    : undefined;
};

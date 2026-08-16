import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { parse } from "$formula/api/evaluate/parse";
import { reduce } from "$formula/api/evaluate/reduce/reduce";
import { formulaRefusal } from "$formula/errors";
import type { Cells, Evaluation } from "$formula/types/evaluation";

/**
 * Computes one expression, now.
 *
 * Nothing is stored: an expression is text on the block that holds it, and this
 * returns what a block records — `state` and either a value or a message.
 *
 * **A refusal becomes a result; a fault stays a fault.** A formula that cannot
 * be computed is an ordinary outcome that the block displays, so every
 * `FormulaError` is caught here. Anything else is a bug in this capability or a
 * database that failed, and reporting those as `state: "error"` would hide them
 * behind a red cell forever.
 */
export const evaluate = async (
  ctx: QueryCtx,
  scope: Scope,
  expression: string,
  cells: Cells = {}
): Promise<Evaluation> => {
  try {
    return { state: "fresh", value: await reduce(ctx, scope, parse(expression), cells) };
  } catch (error) {
    const refusal = formulaRefusal(error);
    if (!refusal) throw error;
    return { state: "error", error: refusal.message };
  }
};

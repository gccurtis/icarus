import { v } from "convex/values";
import { formulaValueValidator } from "$content/types/value";
import { projectQuery } from "$convex/functions";
import { evaluate as evaluateFormula } from "$formula/api/evaluate/evaluate";

/**
 * Formula's public surface — `api.capabilities.formula.*`. One function, and no
 * table behind it: an expression is text on the block that holds it.
 *
 * **`cells` is an argument because a formula does not know what holds it.** The
 * caller has the sheet, the paragraph, or the slide open and passes the values
 * in scope; making this read a resource would tie evaluation to one resource
 * type and to the revision machinery underneath it. It is a query, so a caller
 * subscribed to one re-runs when a name it resolved changes.
 */
export const evaluate = projectQuery({
  args: {
    expression: v.string(),
    cells: v.optional(v.record(v.string(), formulaValueValidator))
  },
  handler: (ctx, args) => evaluateFormula(ctx, ctx.scope, args.expression, args.cells)
});

import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createSet } from "$resource-sets/api/create/create";
import { list as listSets } from "$resource-sets/api/list/list";
import { resolve as resolveExpression } from "$resource-sets/api/resolve/resolve";
import { revise as reviseSet } from "$resource-sets/api/revise/revise";
import { setExpressionValidator } from "$shared/types/set-expression";

/**
 * Resource sets' public surface — `api.capabilities.resourceSets.*`.
 *
 * **`resolve` takes an expression rather than a set id**, so a scope written
 * inline and one saved under a name go through the same function —
 * `{ op: "set" }` is what connects them. A separate `resolveSet` would be a
 * second mechanism for one question.
 *
 * It is a query, and that is the model: resolution is a point in time, it writes
 * nothing, and Convex re-runs it for every subscriber when anything it read
 * changes. A caller that needs to remember what it saw records the refs itself.
 */
const draft = {
  name: v.string(),
  description: v.optional(v.string()),
  expression: setExpressionValidator
};

export const list = projectQuery({
  args: {},
  handler: (ctx) => listSets(ctx, ctx.scope)
});

export const resolve = projectQuery({
  args: { expression: setExpressionValidator },
  handler: (ctx, args) => resolveExpression(ctx, ctx.scope, args.expression)
});

export const create = projectMutation({
  args: draft,
  handler: (ctx, args) => createSet(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: { setId: v.id("resourceSets"), revision: v.number(), ...draft },
  handler: (ctx, args) => reviseSet(ctx, ctx.scope, args.setId, args.revision, args)
});

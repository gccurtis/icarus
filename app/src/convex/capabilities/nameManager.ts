import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { define as defineVariable } from "$name-manager/api/define/define";
import { list as listVariables } from "$name-manager/api/list/list";
import { remove as removeVariable } from "$name-manager/api/remove/remove";
import { valueTypeValidator, variableValueValidator } from "$name-manager/types/variable";

/**
 * The name manager's public surface — `api.capabilities.nameManager.*`.
 *
 * **camelCase, alone with the other doors**: Convex rejects a hyphen in a module
 * path, so the capability directory `name-manager/` answers here as
 * `nameManager`.
 *
 * `value` is validated at the door and its agreement with `declaredType` is
 * validated in the handler. The two are different questions — the shape is a
 * wire concern and only `define` knows what was declared — and the second is
 * deliberately reported *after* a name conflict.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listVariables(ctx, ctx.scope)
});

export const define = projectMutation({
  args: {
    name: v.string(),
    declaredType: valueTypeValidator,
    value: variableValueValidator
  },
  handler: (ctx, args) => defineVariable(ctx, ctx.scope, args)
});

export const remove = projectMutation({
  args: { variableId: v.id("nameVariables") },
  handler: (ctx, args) => removeVariable(ctx, ctx.scope, args.variableId)
});

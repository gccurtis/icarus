import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { list as listSettings } from "$settings/api/list/list";
import { set as setSetting } from "$settings/api/set/set";

/**
 * Settings' public surface — `api.capabilities.settings.*`.
 *
 * **This file's path is its public name**, and everything exported here is
 * reachable by anything holding the deployment URL. Built from `projectQuery`
 * and `projectMutation`, so each call resolves its project token to a membership
 * before the handler runs, and the handler receives `ctx.scope` rather than a
 * project it could have chosen.
 *
 * The registrations are written here rather than re-exported from the capability
 * for two reasons: codegen types a real `query({...})` definition properly, where
 * a re-export through a path alias can degrade the generated API to `AnyApi`;
 * and a module only becomes a Convex function by sitting under the functions
 * directory, so this is the only place it could be.
 *
 * **Admission is here, not in the handler.** A Convex validator is the documented
 * security boundary for a public function, so the shape is checked at the door.
 * Canonicalizing a key is semantics and stays with the handler that owns the
 * invariant.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listSettings(ctx, ctx.scope)
});

export const set = projectMutation({
  args: { key: v.string(), value: v.string() },
  handler: (ctx, args) => setSetting(ctx, ctx.scope, args.key, JSON.parse(args.value))
});

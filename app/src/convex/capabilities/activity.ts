import { list as listActivity } from "$activity/api/list/list";
import { projectQuery } from "$convex/functions";

/**
 * Activity's public surface — `api.capabilities.activity.*`.
 *
 * **One function, and the omission is the design.** `record` is not registered
 * and never will be: entries are written by the capability that did the thing,
 * inside the same transaction, so the log cannot disagree with what happened. A
 * log a client can append to is not evidence of anything, and a registration
 * here is exactly that — this file's path is its public name.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listActivity(ctx, ctx.scope)
});

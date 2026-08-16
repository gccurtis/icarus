import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { consolidate as consolidateResource } from "$revisions/api/consolidate/consolidate";
import { read as readResource } from "$revisions/api/read/read";
import { submit as submitChange } from "$revisions/api/submit/submit";
import { opValidator, resourceTypeValidator } from "$revisions/types/change";

/**
 * Revisions' public surface — `api.capabilities.revisions.*`.
 *
 * Three functions for one resource: what it says now, what someone wants it to
 * say, and the maintenance that keeps the first cheap. `start` is in none of
 * them — a client that could plant a body under an id it chose would be creating
 * resources the capability that owns them never made.
 *
 * **`ops` is validated at the door and decided in the handler.** The shape is
 * this validator's business — an op that is not one of the five never reaches
 * the ladder — and whether the change may land is the ladder's, which needs the
 * window to answer. `baseRevision` is an argument because it is what the author
 * was looking at; the revision it lands at is not, because that is read here.
 */
const resource = { resourceType: resourceTypeValidator, resourceId: v.string() };

export const read = projectQuery({
  args: resource,
  handler: (ctx, args) => readResource(ctx, ctx.scope, args)
});

export const submit = projectMutation({
  args: { ...resource, baseRevision: v.number(), ops: v.array(opValidator) },
  handler: (ctx, args) => submitChange(ctx, ctx.scope, args)
});

/**
 * Registered rather than hidden: folding is a real maintenance action someone
 * triggers, and it refuses a resource the caller cannot already read, so the
 * worst a client can do with it is pay for a fold it was going to get anyway.
 */
export const consolidate = projectMutation({
  args: resource,
  handler: (ctx, args) => consolidateResource(ctx, ctx.scope, args)
});

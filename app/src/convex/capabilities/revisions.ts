import { v } from "convex/values";
import { projectMutation } from "$convex/functions";
import { submit as submitChange } from "$revisions/api/submit/submit";
import { opValidator, resourceTypeValidator } from "$revisions/types/change";

/**
 * Revisions' public surface — `api.capabilities.revisions.*`.
 *
 * `read` and `consolidate` join `submit` in task 10. Until then the only thing
 * an untrusted caller can reach here is the one write, and `api/shared/` holds
 * what all three will call.
 *
 * **`ops` is validated at the door and decided in the handler.** The shape is
 * this validator's business — an op that is not one of the five never reaches
 * the ladder — and whether the change may land is the ladder's, which needs the
 * window to answer. `baseRevision` is an argument because it is what the author
 * was looking at; the revision it lands at is not, because that is read here.
 */
export const submit = projectMutation({
  args: {
    resourceType: resourceTypeValidator,
    resourceId: v.string(),
    baseRevision: v.number(),
    ops: v.array(opValidator)
  },
  handler: (ctx, args) => submitChange(ctx, ctx.scope, args)
});

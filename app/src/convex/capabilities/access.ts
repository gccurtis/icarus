import { mutation } from "$convex/_generated/server";
import { seed as seedAccess } from "$access/api/seed/seed";

/**
 * Access' public surface — `api.capabilities.access.*`.
 *
 * **This is the one registration file that does not use `projectQuery` or
 * `projectMutation`, and it has to be.** The gate resolves a project token
 * against a membership; `seed` is what creates the first membership there is.
 * Scoping it would make it unreachable until it had already run.
 *
 * That is the whole exception, and it is why the rule is written as "a
 * registration is scoped unless its capability's document says why not" rather
 * than as an absolute — see `$access/overview.md`.
 *
 * **`seed` is unauthenticated and world-writable**, which is survivable only
 * because it is idempotent and creates exactly one fixed user and project. It
 * goes when signing up exists.
 */
export const seed = mutation({
  args: {},
  handler: (ctx) => seedAccess(ctx)
});

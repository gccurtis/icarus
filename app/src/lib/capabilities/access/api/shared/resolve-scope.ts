import type { QueryCtx } from "$convex/_generated/server";
import { AccessError } from "$access/errors";
import type { Scope } from "$access/types/access";
import { DEVELOPMENT_SUBJECT } from "$access/types/access";

/**
 * One answer for "no such project" and "not yours".
 *
 * Telling an unauthorized caller that a project exists is itself a disclosure,
 * so a token that resolves to nothing and a token belonging to someone else are
 * indistinguishable from outside.
 */
const refuse = (): never => {
  throw new AccessError("no-such-project", "No such project");
};

/**
 * Turns a project token into the scope a handler runs under, or refuses.
 *
 * **The lookup is the authorization.** A token is only ever resolved within one
 * user's own memberships, so there is no separate membership check to forget —
 * a token that is not in the asking user's rows resolves to no project at all.
 *
 * Called by `projectQuery` and `projectMutation` in `$convex/functions`, which
 * are the only things that call it. It is in `shared/` because both of them do.
 *
 * **Identity is stubbed.** It resolves a fixed development subject rather than
 * `ctx.auth.getUserIdentity()`, so every caller is treated as the same user and
 * nothing is actually kept out. The membership half beneath it is real, which is
 * what makes every handler's signature the final one. Replacing the first two
 * lines is the whole of turning this into real authentication.
 */
export const resolveScope = async (ctx: QueryCtx, projectToken: string): Promise<Scope> => {
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", DEVELOPMENT_SUBJECT))
    .unique();

  if (!user) return refuse();

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_token", (q) =>
      q.eq("userId", user._id).eq("token", projectToken)
    )
    .unique();

  if (!membership) return refuse();

  return { projectId: membership.projectId, userId: user._id };
};

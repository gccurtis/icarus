import type { MutationCtx } from "$convex/_generated/server";
import {
  DEVELOPMENT_PROJECT,
  DEVELOPMENT_SUBJECT,
  DEVELOPMENT_TOKEN
} from "$access/types/access";

/**
 * Creates the one user, project, and membership that exist before there is a
 * way to sign up or invite anyone.
 *
 * Idempotent: it looks for each row before creating it, so running it twice
 * changes nothing and running it after a schema push is always safe.
 *
 * **Temporary.** It exists because `resolveScope` refuses a token with no
 * membership behind it, so without these rows every call to every capability
 * answers `no-such-project` and the application cannot render. It goes when
 * signing up and inviting exist.
 */
export const seed = async (ctx: MutationCtx): Promise<{ token: string }> => {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_subject", (q) => q.eq("subject", DEVELOPMENT_SUBJECT))
    .unique();

  const userId =
    existing?._id ??
    (await ctx.db.insert("users", {
      subject: DEVELOPMENT_SUBJECT,
      displayName: "Development User"
    }));

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_token", (q) =>
      q.eq("userId", userId).eq("token", DEVELOPMENT_TOKEN)
    )
    .unique();

  if (membership) return { token: DEVELOPMENT_TOKEN };

  const projectId = await ctx.db.insert("projects", { name: DEVELOPMENT_PROJECT });

  await ctx.db.insert("memberships", {
    userId,
    projectId,
    token: DEVELOPMENT_TOKEN,
    role: "owner"
  });

  return { token: DEVELOPMENT_TOKEN };
};

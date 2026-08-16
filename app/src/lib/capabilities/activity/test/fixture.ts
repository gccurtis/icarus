import type { Scope } from "$access/types/access";
import type { ActivityEntry } from "$activity/types/activity";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; neither handler touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

export const projectNamed = async (ctx: ReturnType<typeof fakeCtx>, name: string) =>
  await ctx.db.insert("projects", { name, revision: 1, updatedAt: NOW });

/** The caller: one user, one project, and the scope the gate would have produced. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  return { ctx, scope: scopeOf(await projectNamed(ctx, "Development"), userId), userId };
};

export const entryBy = (userId: string, verb: string): ActivityEntry => ({
  actor: { kind: "user", userId: userId as Id<"users"> },
  verb,
  target: { type: "document", id: "documents:1", label: "Q3 plan" }
});

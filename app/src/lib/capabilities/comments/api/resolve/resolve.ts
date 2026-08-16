import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireThread } from "$comments/api/shared/require-thread";
import { CommentsError } from "$comments/errors";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";

/**
 * Closes a discussion, keeping every word of it.
 *
 * **Resolved hides; it never deletes.** Review discussions are often the only
 * record of why something is the way it is, and deleting on resolve throws that
 * away at precisely the moment it starts being useful.
 *
 * **The resolver is a user, not an actor.** Anything can raise a remark — an agent
 * reviewing a document routinely does — but deciding a question is settled is a
 * judgement a person makes, and the row records who made it.
 *
 * Resolving a resolved thread is refused rather than ignored: the patch would
 * overwrite who closed it, which is the one fact this write exists to record.
 */
export const resolve = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"commentThreads">
): Promise<void> => {
  const thread = await requireThread(ctx, scope, id);
  if (thread.status === "resolved") {
    throw new CommentsError("wrong-status", `Thread ${id} is already resolved`);
  }

  const at = Date.now();
  await ctx.db.patch(id, {
    status: "resolved",
    resolvedBy: scope.userId,
    resolvedAt: at,
    updatedAt: at
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "resolved",
    target: { type: "commentThread", id, label: thread.anchor.quote ?? "a comment" },
    context: {
      type: thread.anchor.targetType,
      id: thread.anchor.targetId,
      label: thread.anchor.targetId
    }
  });
};

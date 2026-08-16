import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireThread } from "$comments/api/shared/require-thread";
import { CommentsError } from "$comments/errors";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";

/**
 * Says a discussion is not settled after all.
 *
 * It exists because resolution has to be reversible for "resolved rather than
 * deleted" to mean anything — a thread closed by mistake would otherwise be
 * unreachable in every surface that hides resolved ones.
 *
 * The resolver is cleared rather than kept as history: who closed it is only
 * interesting while it is closed, and a stale name beside an open thread reads as
 * a claim that somebody settled it.
 */
export const reopen = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"commentThreads">
): Promise<void> => {
  const thread = await requireThread(ctx, scope, id);
  if (thread.status === "open") {
    throw new CommentsError("wrong-status", `Thread ${id} is already open`);
  }

  await ctx.db.patch(id, {
    status: "open",
    resolvedBy: undefined,
    resolvedAt: undefined,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "reopened",
    target: { type: "commentThread", id, label: thread.anchor.quote ?? "a comment" },
    context: {
      type: thread.anchor.targetType,
      id: thread.anchor.targetId,
      label: thread.anchor.targetId
    }
  });
};

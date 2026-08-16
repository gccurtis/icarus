import type { Scope } from "$access/types/access";
import { CommentsError } from "$comments/errors";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * The comment that id names, or a refusal.
 *
 * **It reads the comment's own `projectId` and never the thread above it.** That
 * column is redundant — a comment is only ever reached through an already-scoped
 * thread — and the redundancy is why it exists: a check that has to join upward to
 * decide access is a check that will eventually forget to.
 */
export const requireComment = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"comments">
): Promise<Doc<"comments">> => {
  const comment = await ctx.db.get(id);
  if (!comment || comment.projectId !== scope.projectId) {
    throw new CommentsError("not-found", `Comment not found: ${id}`);
  }
  return comment;
};

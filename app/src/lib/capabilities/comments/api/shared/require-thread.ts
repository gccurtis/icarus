import type { Scope } from "$access/types/access";
import { CommentsError } from "$comments/errors";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * The thread that id names, or a refusal — and the two cases every function taking
 * a thread id starts with.
 *
 * **Not found, never forbidden.** A thread in another project answers exactly as
 * one that never existed, because telling them apart confirms the discussion
 * exists to somebody with no right to know that — which on a comment is worse than
 * on a document, since the refusal would confirm that a discussion about something
 * is happening.
 */
export const requireThread = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"commentThreads">
): Promise<Doc<"commentThreads">> => {
  const thread = await ctx.db.get(id);
  if (!thread || thread.projectId !== scope.projectId) {
    throw new CommentsError("not-found", `Thread not found: ${id}`);
  }
  return thread;
};

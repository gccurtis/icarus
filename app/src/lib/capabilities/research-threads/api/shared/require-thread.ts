import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { ResearchThreadsError } from "$research-threads/errors";

/**
 * The thread that id names, or a refusal — the two cases every function taking a
 * thread id starts with.
 *
 * **Not found, never forbidden.** A thread in another project answers exactly as
 * one that never existed; telling them apart confirms that a conversation about
 * something is happening. The gate proved the caller holds *a* project; this
 * proves the row is in it.
 */
export const requireThread = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"researchThreads">
): Promise<Doc<"researchThreads">> => {
  const thread = await ctx.db.get(id);
  if (!thread || thread.projectId !== scope.projectId) {
    throw new ResearchThreadsError("not-found", `Thread not found: ${id}`);
  }
  return thread;
};

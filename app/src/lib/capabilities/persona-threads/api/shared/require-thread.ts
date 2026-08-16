import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { PersonaThreadsError } from "$persona-threads/errors";

/**
 * The thread that id names, or a refusal — what every function taking a thread
 * id starts with.
 *
 * **Not found, never forbidden.** A thread in another project answers exactly as
 * one that never existed; telling them apart confirms that a conversation with
 * somebody is happening.
 *
 * **There is no check beyond the project.** Any member may read any thread:
 * these are project content rather than private correspondence, and a chat that
 * turned into a task is part of why the task exists.
 */
export const requireThread = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"personaThreads">
): Promise<Doc<"personaThreads">> => {
  const thread = await ctx.db.get(id);
  if (!thread || thread.projectId !== scope.projectId) {
    throw new PersonaThreadsError("not-found", `Thread not found: ${id}`);
  }
  return thread;
};

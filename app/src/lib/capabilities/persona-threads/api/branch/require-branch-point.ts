import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { PersonaThreadsError } from "$persona-threads/errors";
import type { BranchPoint } from "$persona-threads/types/persona-thread";

/**
 * Proves the message named is a turn of the thread named, in this project.
 *
 * **A branch point is a pair, and the pair has to agree.** A message from
 * another conversation would leave the new thread claiming to continue from a
 * turn nobody could reach by reading the thread it says it came from.
 *
 * Not found, never forbidden, for the same reason as everywhere else here.
 */
export const requireBranchPoint = async (
  ctx: QueryCtx,
  scope: Scope,
  from: BranchPoint
): Promise<void> => {
  const message = await ctx.db.get(from.messageId);
  const inThread =
    message?.projectId === scope.projectId &&
    message.thread.kind === "persona" &&
    message.thread.id === from.threadId;

  if (!inThread) {
    throw new PersonaThreadsError(
      "not-found",
      `Message not found in thread ${from.threadId}: ${from.messageId}`
    );
  }
};

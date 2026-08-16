import type { Scope } from "$access/types/access";
import { AgentTasksError } from "$agent-tasks/errors";
import type { BranchPoint } from "$agent-tasks/types/agent-task";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * Proves the message named is a turn of the persona chat named, in this project.
 *
 * **A branch point is a pair, and the pair has to agree.** The task inherits the
 * conversation up to that message as context; a message from another chat would
 * leave it claiming to continue from a turn nobody can reach by reading the
 * thread it says it came from.
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
    throw new AgentTasksError(
      "not-found",
      `Message not found in thread ${from.threadId}: ${from.messageId}`
    );
  }
};

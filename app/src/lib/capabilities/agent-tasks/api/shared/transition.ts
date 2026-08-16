import { AgentTasksError } from "$agent-tasks/errors";
import { hasFinished, type AgentTaskStatus } from "$agent-tasks/types/agent-task";
import type { Doc } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";

/**
 * Where a task may go from where it is.
 *
 * The three terminal states are empty on purpose: a task stops once. A completed
 * run that could be failed later would make "how often does this fail" a
 * question about who wrote last.
 */
const LEGAL: Readonly<Record<AgentTaskStatus, readonly AgentTaskStatus[]>> = {
  draft: ["running", "cancelled"],
  running: ["waiting", "complete", "failed", "cancelled"],
  // A task blocked on a person can be answered, abandoned, or time out.
  waiting: ["running", "failed", "cancelled"],
  complete: [],
  failed: [],
  cancelled: []
};

/** What a transition may write beside the status. */
type Alongside = Partial<
  Pick<Doc<"agentTasks">, "startedAt" | "finishedAt" | "result" | "error" | "plan">
>;

/**
 * Moves a task to a new status, or refuses.
 *
 * **One procedure, because the lifecycle is one rule.** Every caller that
 * changes a status goes through it — the runner's own steps and a person's
 * cancel alike — so there is one table saying what follows what rather than a
 * guard per entry point, free to disagree.
 *
 * `already-finished` is told apart from `bad-transition` because they are
 * different answers: the first says somebody else got there first, and the
 * second says the caller asked for something that is not a move.
 */
export const moveTo = async (
  ctx: MutationCtx,
  task: Doc<"agentTasks">,
  to: AgentTaskStatus,
  alongside: Alongside = {}
): Promise<void> => {
  if (hasFinished(task.status)) {
    throw new AgentTasksError(
      "already-finished",
      `Task ${task._id} has already ${task.status === "complete" ? "completed" : task.status}`
    );
  }
  if (!LEGAL[task.status].includes(to)) {
    throw new AgentTasksError("bad-transition", `A ${task.status} task cannot become ${to}`);
  }

  await ctx.db.patch(task._id, { ...alongside, status: to, updatedAt: Date.now() });
};

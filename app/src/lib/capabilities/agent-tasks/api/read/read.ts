import type { Scope } from "$access/types/access";
import { asTask } from "$agent-tasks/api/shared/as-task";
import { requireTask } from "$agent-tasks/api/shared/require-task";
import type { AgentTask } from "$agent-tasks/types/agent-task";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * One task, opened by its own address.
 *
 * It carries the prompt and the result, which the list does not: this is the
 * page where somebody asks what the task was told to do and what came of it. The
 * conversation is `messages.list(("task", id))` and is not read here — the two
 * capabilities meet at the index and nowhere else.
 */
export const read = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"agentTasks">
): Promise<AgentTask> => asTask(await requireTask(ctx, scope, id));

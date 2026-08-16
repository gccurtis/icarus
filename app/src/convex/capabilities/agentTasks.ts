import { v } from "convex/values";
import { cancel as cancelTask } from "$agent-tasks/api/cancel/cancel";
import { dispatch as dispatchTask } from "$agent-tasks/api/dispatch/dispatch";
import { list as listTasks } from "$agent-tasks/api/list/list";
import { read as readTask } from "$agent-tasks/api/read/read";
import {
  agentTaskStatusValidator,
  branchPointValidator
} from "$agent-tasks/types/agent-task";
import { projectMutation, projectQuery } from "$convex/functions";

/**
 * Agent tasks' public surface — `api.capabilities.agentTasks.*`.
 *
 * **Four functions, and they are the ones a person performs.** Dispatching work
 * and stopping it are decisions somebody makes; running it is not.
 * [`startRun`, `waitForInput`, `setPlan`, `completeTask`, and
 * `failTask`](../../lib/capabilities/agent-tasks/api/shared/shared.md) are
 * registered nowhere, because a client that could declare a task complete could
 * put a fabricated deliverable under its id and have the feed sign it with the
 * agent's name.
 *
 * **`origin` is built from `ctx.scope`.** A browser cannot claim a task was
 * dispatched by somebody else, or by another task — a task delegating work calls
 * the handler directly with its own actor.
 *
 * **Nothing here reads or writes a message.** A turn is
 * `api.capabilities.messages.*` naming this task's id, so the two capabilities
 * meet at `by_thread(("task", id))` and nowhere else.
 */
export const list = projectQuery({
  args: {
    status: v.optional(agentTaskStatusValidator),
    personaId: v.optional(v.id("personas"))
  },
  handler: (ctx, args) =>
    listTasks(ctx, ctx.scope, { status: args.status, personaId: args.personaId })
});

export const read = projectQuery({
  args: { taskId: v.id("agentTasks") },
  handler: (ctx, args) => readTask(ctx, ctx.scope, args.taskId)
});

export const dispatch = projectMutation({
  args: {
    title: v.string(),
    /** Stored verbatim: it is what goes to the model, and the task's provenance. */
    prompt: v.string(),
    description: v.optional(v.string()),
    personaId: v.optional(v.id("personas")),
    branchedFrom: v.optional(branchPointValidator)
  },
  handler: (ctx, args) =>
    dispatchTask(ctx, ctx.scope, { kind: "user", userId: ctx.scope.userId }, args)
});

export const cancel = projectMutation({
  args: { taskId: v.id("agentTasks") },
  handler: (ctx, args) => cancelTask(ctx, ctx.scope, args.taskId)
});

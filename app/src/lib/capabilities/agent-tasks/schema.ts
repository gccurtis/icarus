import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentTaskStatusValidator,
  branchPointValidator,
  planStepValidator
} from "$agent-tasks/types/agent-task";
import { blockValidator } from "$content/types/block";
import { actorValidator } from "$shared/types/actor";

/**
 * A unit of work handed to an agent: the goal and the outcome.
 *
 * **This row is the thread.** Its messages name it through
 * `by_thread(("task", id))` and carry the task's tool calls — there is no
 * `chatId`, nothing to create before the agent can speak, and no field on either
 * side to keep in sync.
 *
 * **Three names, three jobs.** `prompt` is the kickoff instruction verbatim and
 * is never rewritten, because everything the task did traces back to it.
 * `title` is the short identifying name, and it is the `detail` half of every
 * actor label the task produces. `description` is the summary — separate from
 * the prompt because overwriting it would destroy the provenance, and separate
 * from the title because a name that grew to a paragraph stops working as a
 * label.
 *
 * **`origin` is who dispatched it, and that is not who acted.** Changes the task
 * makes are attributed to the *task*, which is what keeps an agent's edits out of
 * the dispatcher's undo stack. An `agent` origin names the parent task, so a tree
 * of delegated work has a root and a runaway loop is visible as depth.
 *
 * `_creationTime`, `startedAt`, and `finishedAt` are three distinct moments,
 * because a queued task and a running one are not the same thing. Per-turn timing
 * lives on the messages.
 */
export const agentTasksTables = {
  agentTasks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    prompt: v.string(),
    description: v.optional(v.string()),
    /** Absent on a task nobody assigned a persona to; the run still has a prompt. */
    personaId: v.optional(v.id("personas")),
    branchedFrom: v.optional(branchPointValidator),
    status: agentTaskStatusValidator,
    origin: actorValidator,
    /** Rewritten wholesale when the agent revises it. Plan history is not kept. */
    plan: v.optional(v.array(planStepValidator)),
    result: v.optional(v.array(blockValidator)),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index("by_project_status", ["projectId", "status"])
    .index("by_persona", ["projectId", "personaId"])
};

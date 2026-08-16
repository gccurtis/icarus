import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A conversation with a persona that is not a task.
 *
 * **This row is the thread.** Messages name it through
 * `by_thread(("persona", id))`; there is no separate conversation object and
 * nothing to create before somebody can speak.
 *
 * **It carries almost nothing beyond its persona, and that is why it exists
 * separately from an agent task.** A task has a goal, a status, a plan, and a
 * result because it is work someone wants finished. Asking "what did you find in
 * the Q3 scan" is not a unit of work, and a status field on it would mean every
 * question needs closing.
 *
 * `branchedFrom` records where a thread continued from. There is no `revision`:
 * messages are append-only, so changing a conversation is branching rather than
 * editing, and the original is left intact.
 */
export const personaThreadsTables = {
  personaThreads: defineTable({
    projectId: v.id("projects"),
    personaId: v.id("personas"),
    title: v.string(),
    branchedFrom: v.optional(
      v.object({ threadId: v.id("personaThreads"), messageId: v.id("messages") })
    ),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_persona", ["projectId", "personaId"])
};

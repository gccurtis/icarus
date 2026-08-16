import { defineTable } from "convex/server";
import { v } from "convex/values";
import { researchThreadModeValidator } from "$research-threads/types/research-thread";
import { actorValidator } from "$shared/types/actor";

/**
 * The working conversation, aimed at something.
 *
 * **This row is the thread.** There is no separate conversation object and no
 * `chatId` — messages name this row and `by_thread(("research", id))` is the
 * whole link. What the row holds is only what makes it *research*: its mode and
 * what it is anchored to.
 *
 * **`questionId` and `hypothesisId` are direct fields rather than research
 * links.** A thread is about one thing, which its mode names, so the
 * relationship is one-to-one; routing it through the many-to-many table would
 * make every thread read a join to answer something it already knows.
 *
 * Messages are not embedded, because a conversation grows without bound and
 * embedding would walk the thread into Convex's document limit while rewriting
 * the whole history on every reply.
 *
 * `revision` is the stale-form check, and `by_question` is what puts a thread in
 * context on the question it belongs to in one indexed read.
 */
export const researchThreadsTables = {
  researchThreads: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    mode: researchThreadModeValidator,
    /** Set on a `question` thread, absent on every other — enforced by the mutations. */
    questionId: v.optional(v.id("questions")),
    hypothesisId: v.optional(v.id("hypotheses")),
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_question", ["projectId", "questionId"])
};

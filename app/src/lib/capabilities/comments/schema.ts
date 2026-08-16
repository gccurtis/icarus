import { defineTable } from "convex/server";
import { v } from "convex/values";
import { commentAnchorValidator } from "$comments/types/anchor";
import { blockValidator } from "$content/types/block";
import { actorValidator } from "$shared/types/actor";
import { mentionValidator } from "$shared/types/mention";

/**
 * Discussion attached to a place in the project: the thread owns the anchor and
 * the resolved state, and comments are the replies.
 *
 * **A thread is resolved, never deleted.** Review discussions are often the only
 * record of why something is the way it is, and deleting on resolve throws that
 * away at precisely the moment it starts being useful — so there is no deletion
 * column and no history to keep.
 *
 * **`comments.projectId` is here even though a comment is reached through an
 * already-scoped thread.** The column is redundant and the redundancy is the
 * point: a query that has to join upward to check access is a query that will
 * eventually forget to.
 *
 * **`mentions` is extracted rather than left inside the blocks**, so "comments
 * mentioning me" reads a column instead of every comment body in the project.
 * Convex has no array-containment index, so the lookup that makes it cheap arrives
 * with notifications — and it can be built from this column without opening a
 * single body, which is what the extraction buys.
 */
export const commentsTables = {
  commentThreads: defineTable({
    projectId: v.id("projects"),
    anchor: commentAnchorValidator,
    status: v.union(v.literal("open"), v.literal("resolved")),
    /** A user, not an actor: anything can raise a remark, closing one is a judgement. */
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_target", ["projectId", "anchor.targetType", "anchor.targetId"]),

  comments: defineTable({
    projectId: v.id("projects"),
    threadId: v.id("commentThreads"),
    blocks: v.array(blockValidator),
    author: actorValidator,
    mentions: v.optional(v.array(mentionValidator)),
    /** Marks a remark as changed. The prior text is not kept. */
    editedAt: v.optional(v.number())
  }).index("by_thread", ["projectId", "threadId"])
};

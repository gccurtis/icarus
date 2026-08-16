import type { Scope } from "$access/types/access";
import type { CommentTarget } from "$comments/types/anchor";
import type { Comment, Thread } from "$comments/types/comment";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/** What a reader is looking at: one document, one deck, one finding. */
export type Target = { targetType: CommentTarget; targetId: string };

const commentsOf = (row: Doc<"comments">): Comment => ({
  id: row._id,
  blocks: row.blocks,
  author: row.author,
  mentions: row.mentions,
  editedAt: row.editedAt,
  at: row._creationTime
});

/**
 * The discussion on one thing, or across the whole project.
 *
 * The target form is the one an editor opens with, and `by_target` makes it one
 * indexed range rather than a scan of everything the project has ever discussed.
 * Without a target it is the project's own range — a review queue rather than a
 * document.
 *
 * **Comments are read per thread**, each an exact `(projectId, threadId)` range.
 * The alternative, one project-wide read filtered in memory, costs more the moment
 * a project holds more comments than the thing being opened holds threads.
 *
 * **Resolved threads are returned.** Hiding them is a decision the surface makes —
 * a document view hides them, a review queue shows them — and filtering here would
 * take that choice away.
 */
export const list = async (ctx: QueryCtx, scope: Scope, target?: Target): Promise<Thread[]> => {
  const threads = target
    ? await ctx.db
        .query("commentThreads")
        .withIndex("by_target", (q) =>
          q
            .eq("projectId", scope.projectId)
            .eq("anchor.targetType", target.targetType)
            .eq("anchor.targetId", target.targetId)
        )
        .collect()
    : await ctx.db
        .query("commentThreads")
        .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
        .collect();

  return await Promise.all(
    threads.map(async (thread) => {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_thread", (q) =>
          q.eq("projectId", scope.projectId).eq("threadId", thread._id)
        )
        .collect();

      // `projectId` stops here: every thread returned is from the project that was
      // asked about, so repeating it per row says nothing.
      return {
        id: thread._id,
        anchor: thread.anchor,
        status: thread.status,
        resolvedBy: thread.resolvedBy,
        resolvedAt: thread.resolvedAt,
        createdBy: thread.createdBy,
        updatedAt: thread.updatedAt,
        comments: comments.map(commentsOf)
      };
    })
  );
};

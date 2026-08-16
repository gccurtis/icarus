import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireComment } from "$comments/api/edit/require-comment";
import { requireThread } from "$comments/api/shared/require-thread";
import { CommentsError } from "$comments/errors";
import { commentBody } from "$comments/types/comment";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Mention } from "$shared/types/mention";

/**
 * Rewrites a remark, and marks it as rewritten.
 *
 * **Only the person who said it may change it**, which excludes an agent's remarks
 * from being edited by anyone: a comment is attributed, and rewriting words under
 * somebody else's name changes what they are recorded as having said.
 *
 * The prior text is not kept. A comment is a turn in a conversation rather than a
 * document, and version history for one would be storage nobody reads — `editedAt`
 * is the whole of what a reader needs, which is that this is not what was written.
 */
export const edit = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"comments">,
  blocks: ContentBlock[],
  mentions?: Mention[]
): Promise<void> => {
  const comment = await requireComment(ctx, scope, id);
  if (comment.author.kind !== "user" || comment.author.userId !== scope.userId) {
    throw new CommentsError("not-author", `Comment ${id} is somebody else's remark`);
  }

  const said = commentBody(blocks);
  await ctx.db.patch(id, { blocks: said, mentions, editedAt: Date.now() });

  // Access was decided by the comment's own column; the thread is read for what
  // the entry has to say about what the remark is attached to.
  const thread = await requireThread(ctx, scope, comment.threadId);
  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "edited",
    target: {
      type: "commentThread",
      id: comment.threadId,
      label: thread.anchor.quote ?? "a comment"
    },
    context: {
      type: thread.anchor.targetType,
      id: thread.anchor.targetId,
      label: thread.anchor.targetId
    }
  });
};

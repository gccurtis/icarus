import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { resolveAnchor } from "$comments/api/start/resolve-anchor";
import { commentAnchor, type CommentAnchor } from "$comments/types/anchor";
import { commentBody } from "$comments/types/comment";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";
import type { Mention } from "$shared/types/mention";

/** A discussion as the person opening it wrote it: where, what, and who it is for. */
export type NewThread = {
  anchor: CommentAnchor;
  blocks: ContentBlock[];
  mentions?: Mention[];
  /** The resource revision the selection was made against. Now, when absent. */
  baseRevision?: number;
};

/**
 * Opens a discussion: the anchor, and the remark that made it worth anchoring.
 *
 * **The thread and its first comment are written together**, because a thread with
 * no remark on it is a marker in a document that nobody can act on and nobody can
 * tell was a mistake.
 *
 * **The anchor is resolved before it is stored.** A selection is made against the
 * revision the author was looking at, and edits land while they are typing — so
 * the range is carried forward and the id checked against the resource as it now
 * stands, rather than stored as sent and left pointing at text that has moved.
 *
 * The actor is built from the scope, never accepted: an argument naming the author
 * would let a caller sign somebody else's name to a remark.
 */
export const start = async (
  ctx: MutationCtx,
  scope: Scope,
  input: NewThread
): Promise<Id<"commentThreads">> => {
  const blocks = commentBody(input.blocks);
  const anchor = await resolveAnchor(
    ctx,
    scope,
    commentAnchor(input.anchor),
    input.baseRevision
  );
  const by: Actor = { kind: "user", userId: scope.userId };
  const at = Date.now();

  const threadId = await ctx.db.insert("commentThreads", {
    projectId: scope.projectId,
    anchor,
    status: "open",
    createdBy: by,
    updatedAt: at
  });

  await ctx.db.insert("comments", {
    projectId: scope.projectId,
    threadId,
    blocks,
    author: by,
    mentions: input.mentions
  });

  await record(ctx, scope, {
    actor: by,
    verb: "commented",
    target: { type: "commentThread", id: threadId, label: anchor.quote ?? "a comment" },
    // The thing it is about, so the log reads without opening the thread.
    context: { type: anchor.targetType, id: anchor.targetId, label: anchor.targetId }
  });

  return threadId;
};

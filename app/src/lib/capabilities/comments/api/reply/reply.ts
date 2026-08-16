import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import { requireThread } from "$comments/api/shared/require-thread";
import { commentBody } from "$comments/types/comment";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";
import type { Mention } from "$shared/types/mention";

/**
 * Adds a remark to a discussion.
 *
 * **A reply does not reopen a resolved thread.** A resolved discussion is still a
 * discussion — adding to it is an ordinary thing to do, and deciding that the
 * question is open again is a separate judgement with its own function.
 *
 * The thread's `updatedAt` moves because that is what a "recently active" list
 * reads; nothing else about the thread is touched.
 */
export const reply = async (
  ctx: MutationCtx,
  scope: Scope,
  threadId: Id<"commentThreads">,
  blocks: ContentBlock[],
  mentions?: Mention[]
): Promise<Id<"comments">> => {
  const thread = await requireThread(ctx, scope, threadId);
  const said = commentBody(blocks);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("comments", {
    projectId: scope.projectId,
    threadId,
    blocks: said,
    author: by,
    mentions
  });
  await ctx.db.patch(threadId, { updatedAt: Date.now() });

  await record(ctx, scope, {
    actor: by,
    verb: "replied",
    target: { type: "commentThread", id: threadId, label: thread.anchor.quote ?? "a comment" },
    context: {
      type: thread.anchor.targetType,
      id: thread.anchor.targetId,
      label: thread.anchor.targetId
    }
  });

  return id;
};

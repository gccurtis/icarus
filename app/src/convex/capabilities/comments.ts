import { v } from "convex/values";
import { edit as editComment } from "$comments/api/edit/edit";
import { list as listThreads } from "$comments/api/list/list";
import { reopen as reopenThread } from "$comments/api/reopen/reopen";
import { reply as replyToThread } from "$comments/api/reply/reply";
import { resolve as resolveThread } from "$comments/api/resolve/resolve";
import { start as startThread } from "$comments/api/start/start";
import { commentAnchorValidator, commentTargetValidator } from "$comments/types/anchor";
import { blockValidator } from "$content/types/block";
import { projectMutation, projectQuery } from "$convex/functions";
import { mentionValidator } from "$shared/types/mention";

/**
 * Comments' public surface — `api.capabilities.comments.*`.
 *
 * **The anchor is validated for shape here and for sense in the handler.**
 * `commentAnchorValidator` proves a `within` is one of the four variants; which of
 * them a target may hold is a constraint between two fields, which no validator
 * expresses — so it stays with `start`, where the invariant lives.
 *
 * **`author` and `resolvedBy` are arguments to neither.** Both are built from
 * `ctx.scope`: an argument naming the author would let a caller sign somebody
 * else's name to a remark, and one naming the resolver would let them record
 * somebody else's judgement.
 */
export const list = projectQuery({
  args: {
    target: v.optional(
      v.object({ targetType: commentTargetValidator, targetId: v.string() })
    )
  },
  handler: (ctx, args) => listThreads(ctx, ctx.scope, args.target)
});

export const start = projectMutation({
  args: {
    anchor: commentAnchorValidator,
    blocks: v.array(blockValidator),
    mentions: v.optional(v.array(mentionValidator)),
    baseRevision: v.optional(v.number())
  },
  handler: (ctx, args) => startThread(ctx, ctx.scope, args)
});

export const reply = projectMutation({
  args: {
    threadId: v.id("commentThreads"),
    blocks: v.array(blockValidator),
    mentions: v.optional(v.array(mentionValidator))
  },
  handler: (ctx, args) => replyToThread(ctx, ctx.scope, args.threadId, args.blocks, args.mentions)
});

export const edit = projectMutation({
  args: {
    commentId: v.id("comments"),
    blocks: v.array(blockValidator),
    mentions: v.optional(v.array(mentionValidator))
  },
  handler: (ctx, args) => editComment(ctx, ctx.scope, args.commentId, args.blocks, args.mentions)
});

export const resolve = projectMutation({
  args: { threadId: v.id("commentThreads") },
  handler: (ctx, args) => resolveThread(ctx, ctx.scope, args.threadId)
});

export const reopen = projectMutation({
  args: { threadId: v.id("commentThreads") },
  handler: (ctx, args) => reopenThread(ctx, ctx.scope, args.threadId)
});

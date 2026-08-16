import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { projectMutation, projectQuery } from "$convex/functions";
import { finish as finishMessage } from "$messages/api/finish/finish";
import { list as listMessages } from "$messages/api/list/list";
import { post as postMessage } from "$messages/api/post/post";
import { messageRoleValidator } from "$messages/types/message";
import { messageSourceValidator } from "$messages/types/source";
import { threadRefValidator } from "$messages/types/thread";
import { toolCallValidator } from "$messages/types/tool-call";
import { mentionValidator } from "$shared/types/mention";

/**
 * Messages' public surface — `api.capabilities.messages.*`.
 *
 * **Every function takes a `ThreadRef`, and none takes a chat id.** There is no
 * conversation object to open before speaking: a research thread, an agent task,
 * and a persona thread each *are* threads.
 *
 * **`author` is not an argument.** It is built from the scope, so a caller
 * cannot post under somebody else's name — and a caller reaching the door is
 * never the thread's own responder, which is the one case the model leaves
 * unattributed.
 */
export const list = projectQuery({
  args: { thread: threadRefValidator },
  handler: (ctx, args) => listMessages(ctx, ctx.scope, args.thread)
});

export const post = projectMutation({
  args: {
    thread: threadRefValidator,
    role: messageRoleValidator,
    blocks: v.array(blockValidator),
    mentions: v.optional(v.array(mentionValidator)),
    toolCalls: v.optional(v.array(toolCallValidator)),
    sources: v.optional(v.array(messageSourceValidator)),
    streaming: v.optional(v.boolean())
  },
  handler: (ctx, args) =>
    postMessage(ctx, ctx.scope, { ...args, author: { kind: "user", userId: ctx.scope.userId } })
});

export const finish = projectMutation({
  args: {
    messageId: v.id("messages"),
    blocks: v.array(blockValidator),
    toolCalls: v.optional(v.array(toolCallValidator)),
    sources: v.optional(v.array(messageSourceValidator)),
    error: v.optional(v.string())
  },
  handler: (ctx, args) => finishMessage(ctx, ctx.scope, args.messageId, args)
});

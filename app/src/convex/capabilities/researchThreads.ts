import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { list as listThreads } from "$research-threads/api/list/list";
import { read as readThread } from "$research-threads/api/read/read";
import { revise as reviseThread } from "$research-threads/api/revise/revise";
import { start as startThread } from "$research-threads/api/start/start";
import { researchThreadModeValidator } from "$research-threads/types/research-thread";

/**
 * Research threads' public surface — `api.capabilities.researchThreads.*`.
 *
 * **Nothing here opens a conversation.** The row a `start` writes *is* the
 * thread, so the first turn goes to `api.capabilities.messages.post` naming this
 * id, and there is no chat to create in between.
 *
 * **The anchors are ids, not link arguments.** A thread is about one thing and
 * `mode` says which, so `researchThreadAnchor` decides whether the pair the
 * caller sent is a thread the model has.
 *
 * **`createdBy` is an argument to none of them.** It is built from `ctx.scope`.
 */
export const list = projectQuery({
  args: { questionId: v.optional(v.id("questions")) },
  handler: (ctx, args) => listThreads(ctx, ctx.scope, args.questionId)
});

export const read = projectQuery({
  args: { threadId: v.id("researchThreads") },
  handler: (ctx, args) => readThread(ctx, ctx.scope, args.threadId)
});

export const start = projectMutation({
  args: {
    title: v.string(),
    mode: researchThreadModeValidator,
    questionId: v.optional(v.id("questions")),
    hypothesisId: v.optional(v.id("hypotheses"))
  },
  handler: (ctx, args) => startThread(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: {
    threadId: v.id("researchThreads"),
    revision: v.number(),
    title: v.string(),
    mode: researchThreadModeValidator,
    questionId: v.optional(v.id("questions")),
    hypothesisId: v.optional(v.id("hypotheses"))
  },
  handler: (ctx, args) => reviseThread(ctx, ctx.scope, args.threadId, args.revision, args)
});

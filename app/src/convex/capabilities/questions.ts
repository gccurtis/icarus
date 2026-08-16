import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { projectMutation, projectQuery } from "$convex/functions";
import { ask as askQuestion } from "$questions/api/ask/ask";
import { list as listQuestions } from "$questions/api/list/list";
import { remove as removeQuestion } from "$questions/api/remove/remove";
import { revise as reviseQuestion } from "$questions/api/revise/revise";
import { setStatus as setQuestionStatus } from "$questions/api/set-status/set-status";
import { questionStatusValidator } from "$questions/types/question";

/**
 * Questions' public surface — `api.capabilities.questions.*`.
 *
 * **`questionStatusValidator` is the refusal of `parked`.** It lists three
 * literals, so a fourth is rejected here before a handler runs — which is why
 * there is no status argument anywhere that takes a bare string.
 *
 * **`createdBy` is an argument to none of them.** It is built from `ctx.scope`;
 * one naming the author would let a caller sign somebody else's name to a
 * question.
 */
export const list = projectQuery({
  args: { parentId: v.optional(v.id("questions")) },
  handler: (ctx, args) => listQuestions(ctx, ctx.scope, args.parentId)
});

export const ask = projectMutation({
  args: {
    text: v.string(),
    notes: v.array(blockValidator),
    parentId: v.optional(v.id("questions"))
  },
  handler: (ctx, args) => askQuestion(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: {
    questionId: v.id("questions"),
    revision: v.number(),
    text: v.string(),
    notes: v.array(blockValidator),
    parentId: v.optional(v.id("questions"))
  },
  handler: (ctx, args) => reviseQuestion(ctx, ctx.scope, args.questionId, args.revision, args)
});

export const setStatus = projectMutation({
  args: { questionId: v.id("questions"), status: questionStatusValidator },
  handler: (ctx, args) => setQuestionStatus(ctx, ctx.scope, args.questionId, args.status)
});

export const remove = projectMutation({
  args: { questionId: v.id("questions") },
  handler: (ctx, args) => removeQuestion(ctx, ctx.scope, args.questionId)
});

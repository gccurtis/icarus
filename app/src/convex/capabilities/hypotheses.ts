import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { projectMutation, projectQuery } from "$convex/functions";
import { assess as assessHypothesis } from "$hypotheses/api/assess/assess";
import { list as listHypotheses } from "$hypotheses/api/list/list";
import { propose as proposeHypothesis } from "$hypotheses/api/propose/propose";
import { revise as reviseHypothesis } from "$hypotheses/api/revise/revise";
import { hypothesisAssessmentValidator } from "$hypotheses/types/hypothesis";

/**
 * Hypotheses' public surface — `api.capabilities.hypotheses.*`.
 *
 * **No function here takes a question id.** Attaching a hypothesis to a question
 * is a research link, because the relationship is many-to-many and a hypothesis
 * needs no question at all.
 *
 * **`confidence` is optional at the door and refused by the handler when there is
 * no assessment to attach it to** — a constraint between two arguments, which no
 * validator expresses.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listHypotheses(ctx, ctx.scope)
});

export const propose = projectMutation({
  args: { statement: v.string(), rationale: v.array(blockValidator) },
  handler: (ctx, args) => proposeHypothesis(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: {
    hypothesisId: v.id("hypotheses"),
    revision: v.number(),
    statement: v.string(),
    rationale: v.array(blockValidator)
  },
  handler: (ctx, args) => reviseHypothesis(ctx, ctx.scope, args.hypothesisId, args.revision, args)
});

export const assess = projectMutation({
  args: {
    hypothesisId: v.id("hypotheses"),
    assessment: hypothesisAssessmentValidator,
    confidence: v.optional(v.number())
  },
  handler: (ctx, args) =>
    assessHypothesis(ctx, ctx.scope, args.hypothesisId, args.assessment, args.confidence)
});

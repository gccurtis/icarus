import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireHypothesis } from "$hypotheses/api/shared/require-hypothesis";
import {
  hypothesisAssessment,
  hypothesisConfidence,
  type HypothesisAssessment
} from "$hypotheses/types/hypothesis";
import type { Actor } from "$shared/types/actor";

/**
 * Records the judgement on a claim, and how sure of it whoever made it is.
 *
 * **The judgement is stored, never derived** from the findings that link here. A
 * count of supporting against contradicting findings is not a judgement — three
 * weak findings do not outweigh one decisive one — so this is the only thing that
 * writes the column.
 *
 * **It takes no revision.** Assessing is a decision made with the hypothesis in
 * front of you rather than a form filled in over minutes. It still moves
 * `revision` on, because the hypothesis a form was opened against is no longer
 * the one on the row.
 *
 * Moving back to `untested` clears the confidence: a number left behind would
 * stand for a judgement that was withdrawn.
 */
export const assess = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"hypotheses">,
  assessment: HypothesisAssessment,
  confidence?: number
): Promise<void> => {
  const hypothesis = await requireHypothesis(ctx, scope, id);
  const judgement = hypothesisAssessment(assessment);
  const sureness = hypothesisConfidence(judgement, confidence);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, {
    assessment: judgement,
    confidence: sureness,
    updatedBy: by,
    revision: hypothesis.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "assessed",
    target: { type: "hypothesis", id, label: hypothesis.statement },
    detail: judgement
  });
};

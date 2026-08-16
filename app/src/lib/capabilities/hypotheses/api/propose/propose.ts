import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { hypothesisStatement, type HypothesisDraft } from "$hypotheses/types/hypothesis";
import type { Actor } from "$shared/types/actor";

/**
 * Proposes a claim, and returns its id.
 *
 * **No question, and it takes none.** A hunch arrives before the question it
 * belongs to is articulated, and forcing attachment at that moment means either
 * inventing a question nobody asked or losing the hunch. Attachment is a research
 * link, added whenever the connection is made.
 *
 * **`confidence` is not written at all**, rather than written as zero. A claim
 * nobody has tested has no confidence to report, and a default is a number that
 * charts and summaries consume as though somebody chose it.
 */
export const propose = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: HypothesisDraft
): Promise<Id<"hypotheses">> => {
  const claim = hypothesisStatement(draft.statement);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("hypotheses", {
    projectId: scope.projectId,
    statement: claim,
    rationale: draft.rationale,
    assessment: "untested",
    createdBy: by,
    updatedBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "proposed",
    target: { type: "hypothesis", id, label: claim }
  });

  return id;
};

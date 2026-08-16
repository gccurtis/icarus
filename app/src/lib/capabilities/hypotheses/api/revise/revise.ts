import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireHypothesis } from "$hypotheses/api/shared/require-hypothesis";
import { HypothesesError } from "$hypotheses/errors";
import { hypothesisStatement, type HypothesisDraft } from "$hypotheses/types/hypothesis";
import type { Actor } from "$shared/types/actor";

/**
 * Replaces a hypothesis with the version the author has in front of them.
 *
 * **`revision` is the stale-form check.** Convex's transactions cover a read and
 * a write inside one mutation; they do not cover a form opened before lunch, and
 * `rationale` is exactly what somebody spends that long on. Rejection is the
 * whole mechanism — the client is told the hypothesis moved and decides what to
 * do.
 *
 * **The assessment is untouched.** Rewording a claim is not reassessing it, and
 * dropping the judgement here would quietly discard work every time a typo was
 * fixed.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"hypotheses">,
  revision: number,
  draft: HypothesisDraft
): Promise<void> => {
  const hypothesis = await requireHypothesis(ctx, scope, id);

  if (hypothesis.revision !== revision) {
    throw new HypothesesError(
      "stale",
      `Hypothesis ${id} has moved to revision ${hypothesis.revision}`
    );
  }

  const claim = hypothesisStatement(draft.statement);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, {
    statement: claim,
    rationale: draft.rationale,
    updatedBy: by,
    revision: hypothesis.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "revised",
    target: { type: "hypothesis", id, label: claim }
  });
};

import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { HypothesesError } from "$hypotheses/errors";

/**
 * The hypothesis that id names, or a refusal — and the two cases every function
 * taking a hypothesis id starts with.
 *
 * **Not found, never forbidden.** One in another project answers exactly as one
 * that never existed; telling them apart confirms what somebody else believes
 * might be true. The gate proved the caller holds *a* project; this proves the
 * row is in it.
 */
export const requireHypothesis = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"hypotheses">
): Promise<Doc<"hypotheses">> => {
  const hypothesis = await ctx.db.get(id);
  if (!hypothesis || hypothesis.projectId !== scope.projectId) {
    throw new HypothesesError("not-found", `Hypothesis not found: ${id}`);
  }
  return hypothesis;
};

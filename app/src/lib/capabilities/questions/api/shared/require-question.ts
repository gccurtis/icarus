import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { QuestionsError } from "$questions/errors";

/**
 * The question that id names, or a refusal — and the two cases every function
 * taking a question id starts with.
 *
 * **Not found, never forbidden.** A question in another project answers exactly
 * as one that never existed; telling them apart confirms what somebody else is
 * trying to find out. The gate proved the caller holds *a* project; this proves
 * the row is in it.
 */
export const requireQuestion = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"questions">
): Promise<Doc<"questions">> => {
  const question = await ctx.db.get(id);
  if (!question || question.projectId !== scope.projectId) {
    throw new QuestionsError("not-found", `Question not found: ${id}`);
  }
  return question;
};

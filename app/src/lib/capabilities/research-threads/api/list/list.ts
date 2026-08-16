import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { asThread } from "$research-threads/api/shared/as-thread";
import type { ResearchThread } from "$research-threads/types/research-thread";

/**
 * The project's threads, or the ones working on one question.
 *
 * **A discover thread is in the wide form rather than outside it.** `projectId`
 * is on the row rather than reached through a question, which is what keeps a
 * thread that is looking for things inside every read.
 *
 * `by_question` is what makes the narrow form one indexed range, and it is the
 * form a question's context panel uses.
 */
export const list = async (
  ctx: QueryCtx,
  scope: Scope,
  questionId?: Id<"questions">
): Promise<ResearchThread[]> => {
  const rows = questionId
    ? await ctx.db
        .query("researchThreads")
        .withIndex("by_question", (q) =>
          q.eq("projectId", scope.projectId).eq("questionId", questionId)
        )
        .collect()
    : await ctx.db
        .query("researchThreads")
        .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
        .collect();

  return rows.map(asThread);
};

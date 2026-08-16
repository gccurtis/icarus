import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireQuestion } from "$questions/api/shared/require-question";
import { QuestionsError } from "$questions/errors";

/**
 * Deletes a question. A real delete, and the one the model asks for: there is no
 * status meaning "we are not doing this", so absence is how a question nobody
 * intends to pursue leaves the list.
 *
 * **A question with sub-questions is refused rather than cascaded.** Deleting the
 * subtree would throw away work somebody did below the question they gave up on,
 * and re-parenting the children would silently reshape a decomposition. Both are
 * decisions for whoever is deleting.
 *
 * The text is read before the row goes, because the entry has to say which
 * question was deleted and there is nothing left to ask afterwards.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"questions">
): Promise<void> => {
  const { text } = await requireQuestion(ctx, scope, id);

  const children = await ctx.db
    .query("questions")
    .withIndex("by_parent", (q) => q.eq("projectId", scope.projectId).eq("parentId", id))
    .collect();
  if (children.length > 0) {
    throw new QuestionsError(
      "has-children",
      `Question ${id} has ${children.length} sub-questions to settle first`
    );
  }

  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "deleted",
    target: { type: "question", id, label: text }
  });
};

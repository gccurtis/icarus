import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { requireQuestion } from "$questions/api/shared/require-question";
import { QuestionsError } from "$questions/errors";

/**
 * The parent a question is about to hang off, proved to be one it can.
 *
 * Two things have to hold, and the second is why the ancestors are walked rather
 * than the parent merely compared: a cycle anywhere in the line makes a tree with
 * no root, which renders as a subtree that has vanished from the project and a
 * traversal that does not end.
 *
 * `child` is absent when the question does not exist yet, and nothing new can be
 * its own ancestor.
 */
export const resolveParent = async (
  ctx: QueryCtx,
  scope: Scope,
  parentId: Id<"questions"> | undefined,
  child?: Id<"questions">
): Promise<Id<"questions"> | undefined> => {
  if (!parentId) return undefined;

  let ancestor: Id<"questions"> | undefined = parentId;
  while (ancestor) {
    const question = await requireQuestion(ctx, scope, ancestor);
    if (child && ancestor === child) {
      throw new QuestionsError("cycle", `Question ${child} cannot sit below itself`);
    }
    ancestor = question.parentId;
  }
  return parentId;
};

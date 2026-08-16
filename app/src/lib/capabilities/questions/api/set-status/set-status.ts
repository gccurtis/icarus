import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireQuestion } from "$questions/api/shared/require-question";
import { questionStatus, type QuestionStatus } from "$questions/types/question";

/**
 * Says where a question now stands.
 *
 * **A function of its own rather than a field of `revise`**, because it is one
 * click from a list and carries no form: it takes no revision, and there is
 * nothing staged behind it to be stale. It still moves `revision` on, since the
 * question a form was opened against is no longer the question on the row.
 *
 * **Nothing is enforced against the children.** A question can be answered while
 * its sub-questions are open — deciding otherwise would be the model ruling on a
 * decomposition that went somewhere unexpected, which is the researcher's call.
 */
export const setStatus = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"questions">,
  status: QuestionStatus
): Promise<void> => {
  const question = await requireQuestion(ctx, scope, id);
  const now = questionStatus(status);

  await ctx.db.patch(id, {
    status: now,
    revision: question.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "marked",
    target: { type: "question", id, label: question.text },
    detail: now
  });
};

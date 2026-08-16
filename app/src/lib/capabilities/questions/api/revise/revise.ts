import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireQuestion } from "$questions/api/shared/require-question";
import { resolveParent } from "$questions/api/shared/resolve-parent";
import { QuestionsError } from "$questions/errors";
import { questionText, type QuestionDraft } from "$questions/types/question";

/**
 * Replaces a question with the version the author has in front of them.
 *
 * **`revision` is the stale-form check.** Convex's transactions cover a read and
 * a write inside one mutation; they do not cover a form opened before lunch, and
 * `notes` are exactly what somebody spends that long on. Rejection is the whole
 * mechanism — the client is told the question moved and decides what to do.
 *
 * **An absent `parentId` is a move to the root, not "unchanged".** The draft is
 * the whole question, so "unchanged" has nowhere to be said, and inventing it
 * would mean a question could never leave a parent.
 *
 * Status is not here: it is one click from a list, with no form behind it.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"questions">,
  revision: number,
  draft: QuestionDraft
): Promise<void> => {
  const question = await requireQuestion(ctx, scope, id);

  if (question.revision !== revision) {
    throw new QuestionsError("stale", `Question ${id} has moved to revision ${question.revision}`);
  }

  const asked = questionText(draft.text);
  const parentId = await resolveParent(ctx, scope, draft.parentId, id);

  await ctx.db.patch(id, {
    text: asked,
    notes: draft.notes,
    parentId,
    revision: question.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "revised",
    target: { type: "question", id, label: asked }
  });
};

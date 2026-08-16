import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { resolveParent } from "$questions/api/shared/resolve-parent";
import { questionText, type QuestionDraft } from "$questions/types/question";
import type { Actor } from "$shared/types/actor";

/**
 * Asks a question, and returns its id.
 *
 * **It starts `open`**, which is where a question waits as well as where it
 * begins — there is no state meaning "not doing this", so nothing else could be
 * the starting value.
 *
 * **Nothing else is attached.** Hypotheses and findings arrive as research links,
 * so a question is complete the moment it is written down.
 */
export const ask = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: QuestionDraft
): Promise<Id<"questions">> => {
  const asked = questionText(draft.text);
  const parentId = await resolveParent(ctx, scope, draft.parentId);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("questions", {
    projectId: scope.projectId,
    text: asked,
    notes: draft.notes,
    status: "open",
    parentId,
    createdBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "asked",
    target: { type: "question", id, label: asked }
  });

  return id;
};

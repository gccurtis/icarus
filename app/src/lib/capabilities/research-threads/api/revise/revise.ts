import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireAnchor } from "$research-threads/api/shared/require-anchor";
import { requireThread } from "$research-threads/api/shared/require-thread";
import { ResearchThreadsError } from "$research-threads/errors";
import {
  researchThreadAnchor,
  researchThreadTitle,
  type ResearchThreadDraft
} from "$research-threads/types/research-thread";

/**
 * Restates what the thread is working on.
 *
 * **Re-anchoring is the discovery workflow, not a correction.** A discover
 * thread that turns up the question it was looking for becomes a question thread
 * pointed at it, and one whose question dissolved goes back to discovering.
 *
 * **The draft is the whole thread**, so an absent anchor means no anchor rather
 * than "unchanged" — the alternative leaves `mode` and the ids two statements
 * free to disagree about what the thread is about.
 *
 * `revision` is the stale-form check: two people in one room can both have the
 * thread open, and Convex's transactions cover neither of their forms.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"researchThreads">,
  revision: number,
  draft: ResearchThreadDraft
): Promise<void> => {
  const thread = await requireThread(ctx, scope, id);

  if (thread.revision !== revision) {
    throw new ResearchThreadsError(
      "stale",
      `Thread ${id} has moved to revision ${thread.revision}`
    );
  }

  const title = researchThreadTitle(draft.title);
  const anchor = researchThreadAnchor(draft.mode, draft);
  await requireAnchor(ctx, scope, anchor);

  await ctx.db.patch(id, {
    title,
    mode: draft.mode,
    ...anchor,
    revision: thread.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "revised",
    target: { type: "researchThread", id, label: title }
  });
};

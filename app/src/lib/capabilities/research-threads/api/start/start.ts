import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireAnchor } from "$research-threads/api/shared/require-anchor";
import {
  researchThreadAnchor,
  researchThreadTitle,
  type ResearchThreadDraft
} from "$research-threads/types/research-thread";
import type { Actor } from "$shared/types/actor";

/**
 * Opens a research thread, and returns its id.
 *
 * **The row it writes is the thread.** Nothing is created beside it and no
 * conversation is opened first — messages name this id, and the first one can be
 * posted the moment this returns.
 *
 * **A `discover` thread starts with nothing to anchor to**, which is the mode
 * rather than an incomplete thread: it is driven by its prompt, and discovery is
 * how questions get found in the first place.
 */
export const start = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: ResearchThreadDraft
): Promise<Id<"researchThreads">> => {
  const title = researchThreadTitle(draft.title);
  const anchor = researchThreadAnchor(draft.mode, draft);
  await requireAnchor(ctx, scope, anchor);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("researchThreads", {
    projectId: scope.projectId,
    title,
    mode: draft.mode,
    ...anchor,
    createdBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "started",
    target: { type: "researchThread", id, label: title }
  });

  return id;
};

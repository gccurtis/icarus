import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireBranchPoint } from "$persona-threads/api/branch/require-branch-point";
import { requireThread } from "$persona-threads/api/shared/require-thread";
import { personaThreadTitle, type BranchPoint } from "$persona-threads/types/persona-thread";
import type { Actor } from "$shared/types/actor";

/**
 * Continues a conversation from an earlier message into a new thread.
 *
 * **This is the answer to "I want to change what I said".** Messages are
 * append-only, so there is no editing a chat and no undoing one — you take a
 * different path from a point you liked, and both paths remain.
 *
 * **Nothing is copied and nothing in the original is touched.** The earlier
 * turns are reached through `branchedFrom`; copying them would be a second copy
 * of an append-only log, free to disagree with the first.
 *
 * The persona comes from the thread rather than the caller: a branch is the same
 * conversation taking another route, and letting it change who is being talked
 * to would make `branchedFrom` name a thread it has nothing to do with.
 */
export const branch = async (
  ctx: MutationCtx,
  scope: Scope,
  from: BranchPoint,
  title?: string
): Promise<Id<"personaThreads">> => {
  const source = await requireThread(ctx, scope, from.threadId);
  await requireBranchPoint(ctx, scope, from);

  const named = title === undefined ? source.title : personaThreadTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("personaThreads", {
    projectId: scope.projectId,
    personaId: source.personaId,
    title: named,
    branchedFrom: from,
    createdBy: by,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "branched",
    target: { type: "personaThread", id, label: named },
    context: { type: "personaThread", id: from.threadId, label: source.title }
  });

  return id;
};

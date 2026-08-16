import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireThread } from "$persona-threads/api/shared/require-thread";
import { personaThreadTitle } from "$persona-threads/types/persona-thread";

/**
 * Retitles a chat.
 *
 * **The title is the only thing on this row that can change.** The persona is
 * who the conversation is with and `branchedFrom` is where it came from —
 * changing either would make the thread a different one wearing its history, so
 * this is a rename rather than a revise.
 */
export const rename = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"personaThreads">,
  title: string
): Promise<void> => {
  await requireThread(ctx, scope, id);
  const named = personaThreadTitle(title);

  await ctx.db.patch(id, { title: named, updatedAt: Date.now() });

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "renamed",
    target: { type: "personaThread", id, label: named }
  });
};

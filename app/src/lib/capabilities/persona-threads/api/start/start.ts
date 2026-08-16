import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { personaThreadTitle } from "$persona-threads/types/persona-thread";
import { requirePersona } from "$personas/api/shared/require-persona";
import type { Actor } from "$shared/types/actor";

/**
 * Opens a chat with a persona, and returns its id.
 *
 * **The row it writes is the thread.** Nothing is created beside it — messages
 * name this id, and the first one can be posted the moment this returns.
 *
 * **The persona is resolved by
 * [`requirePersona`](../../../personas/api/shared/require-persona.ts)**, so a
 * persona belonging to every project can be chatted with here and one belonging
 * to another project cannot. That rule is stated where personas are, not twice.
 */
export const start = async (
  ctx: MutationCtx,
  scope: Scope,
  personaId: Id<"personas">,
  title: string
): Promise<Id<"personaThreads">> => {
  const named = personaThreadTitle(title);
  await requirePersona(ctx, scope, personaId);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("personaThreads", {
    projectId: scope.projectId,
    personaId,
    title: named,
    createdBy: by,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "started",
    target: { type: "personaThread", id, label: named }
  });

  return id;
};

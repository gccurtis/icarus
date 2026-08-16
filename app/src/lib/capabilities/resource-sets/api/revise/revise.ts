import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireSet } from "$resource-sets/api/shared/require-set";
import { ResourceSetsError } from "$resource-sets/errors";
import { resourceSetName, type ResourceSetDraft } from "$resource-sets/types/resource-set";
import type { Actor } from "$shared/types/actor";

/**
 * Replaces a set with the version the author has in front of them.
 *
 * **The whole draft, not a patch.** An absent field would have to mean either
 * "unchanged" or "cleared" without being able to say which, and clearing a
 * description is an ordinary edit.
 *
 * **`revision` is the stale-form check**, and it matters more here than for a
 * document: a set is referenced rather than copied, so narrowing one silently
 * narrows every persona, prompt block, and output that names it.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"resourceSets">,
  revision: number,
  draft: ResourceSetDraft
): Promise<void> => {
  const set = await requireSet(ctx, scope, id);

  if (set.revision !== revision) {
    throw new ResourceSetsError("stale", `Resource set ${id} has moved to revision ${set.revision}`);
  }

  const name = resourceSetName(draft.name);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, {
    name,
    description: draft.description,
    expression: draft.expression,
    revision: set.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "revised",
    target: { type: "resourceSet", id, label: name }
  });
};

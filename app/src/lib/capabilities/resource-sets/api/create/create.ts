import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { resourceSetName, type ResourceSetDraft } from "$resource-sets/types/resource-set";
import type { Actor } from "$shared/types/actor";

/**
 * Names an expression, and returns the set's id.
 *
 * **The expression is stored as written and never resolved here.** Resolving on
 * save would produce a list, and a list is what a set is not: the point is that
 * a resource created tomorrow is already inside `{ op: "project" }`.
 *
 * **A reference to another set is not checked either.** The only complete check
 * is at resolution — a cycle takes two writes to make, and what a set selects
 * depends on rows that change after it is saved — so half a check here would
 * suggest a guarantee that does not exist.
 *
 * The actor is built from the scope, never accepted: an argument naming the
 * author would let a caller sign someone else's name to a scope.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: ResourceSetDraft
): Promise<Id<"resourceSets">> => {
  const name = resourceSetName(draft.name);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("resourceSets", {
    projectId: scope.projectId,
    name,
    description: draft.description,
    expression: draft.expression,
    createdBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "resourceSet", id, label: name }
  });

  return id;
};

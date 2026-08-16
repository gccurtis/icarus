import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { ResourceSetsError } from "$resource-sets/errors";

/**
 * The set that id names, or a refusal — where `revise` starts, and where
 * `resolve` lands on every `{ op: "set" }`.
 *
 * **Not found, never forbidden.** A set in another project answers exactly as one
 * that never existed. The gate proved the caller holds *a* project; this is what
 * proves the row is in it, and it is the only thing standing between a set
 * reference and another project's material.
 */
export const requireSet = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"resourceSets">
): Promise<Doc<"resourceSets">> => {
  const set = await ctx.db.get(id);
  if (!set || set.projectId !== scope.projectId) {
    throw new ResourceSetsError("not-found", `Resource set not found: ${id}`);
  }
  return set;
};

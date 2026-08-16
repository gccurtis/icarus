import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { ResourceSet } from "$resource-sets/types/resource-set";

/**
 * The project's sets, as expressions.
 *
 * **It resolves nothing.** A list that answered "and here is what each one
 * currently holds" would walk every table once per row, and would hand a reader
 * a snapshot to mistake for the set. What a set selects is
 * [`resolve`](../resolve/resolve.md), asked when something needs the answer.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<ResourceSet[]> => {
  const rows = await ctx.db
    .query("resourceSets")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  // `projectId` stops here: every set returned is from the project that was
  // asked about, so repeating it per row says nothing.
  return rows.map((set) => ({
    id: set._id,
    name: set.name,
    description: set.description,
    expression: set.expression,
    createdBy: set.createdBy,
    revision: set.revision,
    updatedAt: set.updatedAt
  }));
};

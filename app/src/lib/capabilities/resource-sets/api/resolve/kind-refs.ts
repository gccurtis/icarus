import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { connectorFiles } from "$resource-sets/api/resolve/connector-files";
import { RESOURCE_TABLES } from "$resource-sets/api/resolve/resource-tables";
import type { ResourceKind } from "$shared/types/resource";
import type { ResourceRef } from "$shared/types/set-expression";

/**
 * Every resource of one kind in the caller's project — the per-kind catch-all,
 * with the same laziness as `{ op: "project" }` one level down.
 *
 * **It reads a key range, never a scan.** `projectId` leads the index, so a kind
 * cannot reach another project's rows, and a global template — held by no
 * project — is outside the range rather than filtered out of it.
 *
 * `connector` is the one kind with no rows of its own: it resolves to the files
 * every connector brought in, because that is what scoping to a source means.
 */
export const kindRefs = async (
  ctx: QueryCtx,
  scope: Scope,
  kind: ResourceKind
): Promise<ResourceRef[]> => {
  if (kind === "connector") return await connectorFiles(ctx, scope);

  const rows = await ctx.db
    .query(RESOURCE_TABLES[kind])
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  return rows.map((row) => ({ kind, id: row._id }));
};

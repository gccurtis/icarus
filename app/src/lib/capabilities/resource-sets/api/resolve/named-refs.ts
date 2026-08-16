import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { connectorFiles } from "$resource-sets/api/resolve/connector-files";
import { RESOURCE_TABLES } from "$resource-sets/api/resolve/resource-tables";
import type { ResourceRef } from "$shared/types/set-expression";

/**
 * The explicit case — a handful of specific things — checked against the project
 * and expanded where a ref stands for more than itself.
 *
 * **A ref that resolves to nothing is dropped, never refused.** It reads the same
 * for a resource deleted since the set was written and for one belonging to
 * another project, and both readings are wanted: a set outlives what it names,
 * and telling a caller which case they hit would confirm a row exists to someone
 * with no right to know that.
 *
 * The id is normalized against the table its kind names, so a pair that
 * disagrees — a document kind on a finding's id — is not a resource either. The
 * kind is stored beside the id precisely so this needs no probe of every table.
 */
export const namedRefs = async (
  ctx: QueryCtx,
  scope: Scope,
  refs: readonly ResourceRef[]
): Promise<ResourceRef[]> => {
  const found: ResourceRef[] = [];

  for (const ref of refs) {
    if (ref.kind === "connector") {
      found.push(...(await connectorFiles(ctx, scope, ref.id)));
      continue;
    }

    const id = ctx.db.normalizeId(RESOURCE_TABLES[ref.kind], ref.id);
    if (id === null) continue;

    const row = await ctx.db.get(id);
    if (!row || row.projectId !== scope.projectId) continue;

    found.push({ kind: ref.kind, id });
  }

  return found;
};

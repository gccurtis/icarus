import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { Template } from "$templates/types/template";

const asTemplate = (row: Doc<"templates">): Template => ({
  id: row._id,
  name: row.name,
  description: row.description,
  target: row.target,
  slots: row.slots,
  global: row.projectId === undefined,
  createdBy: row.createdBy,
  revision: row.revision,
  updatedAt: row.updatedAt
});

/**
 * Every template the caller may start from: their project's, and the ones
 * belonging to no project.
 *
 * **Two ranges of one index, never a scan.** A missing field indexes as
 * `undefined` and sorts before every id, so the globals are a key range of their
 * own — `eq("projectId", undefined)` is exactly them, and the project range
 * cannot stray into another project's rows. That is the whole reason the optional
 * column still leads the index.
 *
 * The bodies stay behind. `target` is on the row so a picker can offer the
 * document templates without dragging every authored page across the wire.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<Template[]> => {
  const mine = await ctx.db
    .query("templates")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  const everyone = await ctx.db
    .query("templates")
    .withIndex("by_project", (q) => q.eq("projectId", undefined))
    .collect();

  return [...mine, ...everyone].map(asTemplate);
};

import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { Spreadsheet } from "$spreadsheets/types/spreadsheet";

/**
 * One project's workbooks.
 *
 * Cheap by construction: the row carries no grid, so this costs the metadata
 * alone however many cells have been filled in.
 *
 * Unordered beyond the index's own creation order, for the reason
 * [documents](../../../documents/api/list/list.md) is.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<Spreadsheet[]> => {
  const rows = await ctx.db
    .query("spreadsheets")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  // `projectId` stops here: every workbook returned is from the project that was
  // asked about, so repeating it per row says nothing.
  return rows.map(({ _id, title, templateId, createdBy, updatedBy, updatedAt }) => ({
    id: _id,
    title,
    templateId,
    createdBy,
    updatedBy,
    updatedAt
  }));
};

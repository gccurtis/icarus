import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A workbook's metadata. The sheets are a leader snapshot plus a change-set log,
 * for the reason a document's rows are: a Convex patch rewrites the whole row,
 * and a sheet edit is one cell.
 *
 * Nothing about the grid is here — not the sheet list, not the extent. A
 * workbook's shape is edited, and everything edited belongs in the body where an
 * undo reaches it.
 *
 * `templateId` is `v.string()` until `templates` exists in pass 3.
 */
export const spreadsheetsTables = {
  spreadsheets: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    templateId: v.optional(v.string()),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

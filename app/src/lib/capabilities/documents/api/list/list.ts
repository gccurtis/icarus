import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { Document } from "$documents/types/document";

/**
 * One project's documents.
 *
 * Cheap by construction: the row carries no body, so this reads a list of a
 * project's documents at the cost of the metadata alone, however much has been
 * written in them.
 *
 * Unordered beyond the index's own creation order. `by_project` leads with the
 * project and nothing else, and title order and recency are both a sort over a
 * list a caller already holds — a second index buys nothing until a project's
 * documents stop fitting in one read.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<Document[]> => {
  const rows = await ctx.db
    .query("documents")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  // `projectId` stops here: every document returned is from the project that was
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

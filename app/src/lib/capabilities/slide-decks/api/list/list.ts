import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { SlideDeck } from "$slide-decks/types/slide-deck";

/**
 * One project's decks.
 *
 * Cheap by construction, and here it is the difference between a gallery that
 * renders and one that does not: a deck body carries embedded images and
 * per-element layout, and none of it is read to list a project's decks.
 *
 * Unordered beyond the index's own creation order, for the reason
 * [documents](../../../documents/api/list/list.md) is.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<SlideDeck[]> => {
  const rows = await ctx.db
    .query("slideDecks")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  // `projectId` stops here: every deck returned is from the project that was
  // asked about, so repeating it per row says nothing.
  return rows.map(({ _id, title, aspectRatio, templateId, createdBy, updatedBy, updatedAt }) => ({
    id: _id,
    title,
    aspectRatio,
    templateId,
    createdBy,
    updatedBy,
    updatedAt
  }));
};

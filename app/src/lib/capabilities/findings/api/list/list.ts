import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { FindingSummary } from "$findings/types/finding";

// The row is read whole either way — Convex has no column projection — so what
// this saves is the wire and the client's parse, which is where a writeup with a
// table and an image in it actually costs something.
const asSummary = (row: Doc<"findings">): FindingSummary => ({
  id: row._id,
  title: row.title,
  sourceCount: row.sources.length,
  createdBy: row.createdBy,
  updatedBy: row.updatedBy,
  revision: row.revision,
  updatedAt: row.updatedAt
});

/**
 * The project's findings, as a list renders them.
 *
 * **All of them, attached to a question or not.** `projectId` is on the row
 * rather than reached through a question, which is what keeps a finding nobody
 * was looking for inside this read instead of stranded outside every query.
 *
 * The ones bearing on a particular question or hypothesis are a research link
 * read, and that belongs to links rather than here.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<FindingSummary[]> => {
  const rows = await ctx.db
    .query("findings")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  return rows.map(asSummary);
};

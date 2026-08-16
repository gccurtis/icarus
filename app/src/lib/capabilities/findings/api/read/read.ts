import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { requireFinding } from "$findings/api/shared/require-finding";
import type { Finding } from "$findings/types/finding";

/**
 * One finding, whole: the writeup and everything establishing it.
 *
 * Separate from [`list`](../list/list.md) because the body is the substance of a
 * finding — several paragraphs, a table, sometimes an image — and a list that
 * carried it would ship every writeup in the project to print a column of titles.
 */
export const read = async (ctx: QueryCtx, scope: Scope, id: Id<"findings">): Promise<Finding> => {
  const row = await requireFinding(ctx, scope, id);

  // `projectId` stops here: the caller asked about the project they hold.
  return {
    id: row._id,
    title: row.title,
    body: row.body,
    sources: row.sources,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    revision: row.revision,
    updatedAt: row.updatedAt
  };
};

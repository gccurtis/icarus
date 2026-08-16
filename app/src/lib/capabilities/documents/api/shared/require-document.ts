import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * The document that id names, or a refusal — and the two cases every function
 * taking a document id starts with.
 *
 * **Not found, never forbidden.** A document in another project answers exactly
 * as one that never existed, because telling them apart confirms the document
 * exists to someone with no right to know that. The gate proved the caller holds
 * *a* project; this is what proves the row is in it.
 */
export const requireDocument = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"documents">
): Promise<Doc<"documents">> => {
  const document = await ctx.db.get(id);
  if (!document || document.projectId !== scope.projectId) {
    throw new Error(`Document not found: ${id}`);
  }
  return document;
};

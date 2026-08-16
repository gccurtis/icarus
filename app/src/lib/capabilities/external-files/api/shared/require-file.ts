import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { ExternalFilesError } from "$external-files/errors";

/**
 * The file that id names, or a refusal — and the two cases every function taking
 * a file id starts with.
 *
 * **Not found, never forbidden.** A file in another project answers exactly as
 * one that never existed. The gate proved the caller holds *a* project; this is
 * what proves the row is in it.
 */
export const requireFile = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"externalFiles">
): Promise<Doc<"externalFiles">> => {
  const file = await ctx.db.get(id);
  if (!file || file.projectId !== scope.projectId) {
    throw new ExternalFilesError("not-found", `File not found: ${id}`);
  }
  return file;
};

import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { FindingsError } from "$findings/errors";

/**
 * The finding that id names, or a refusal — and the two cases every function
 * taking a finding id starts with.
 *
 * **Not found, never forbidden.** One in another project answers exactly as one
 * that never existed; telling them apart confirms what somebody else has
 * established. The gate proved the caller holds *a* project; this proves the row
 * is in it.
 */
export const requireFinding = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"findings">
): Promise<Doc<"findings">> => {
  const finding = await ctx.db.get(id);
  if (!finding || finding.projectId !== scope.projectId) {
    throw new FindingsError("not-found", `Finding not found: ${id}`);
  }
  return finding;
};

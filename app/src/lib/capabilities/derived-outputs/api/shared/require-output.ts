import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { DerivedOutputsError } from "$derived-outputs/errors";

/**
 * The output that id names, or a refusal — the two cases every function taking
 * an output id starts with.
 *
 * **Not found, never forbidden.** One in another project answers exactly as one
 * that never existed; telling them apart confirms that somebody else's generated
 * content is there. The gate proved the caller holds *a* project; this proves the
 * row is in it.
 */
export const requireOutput = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"derivedOutputs">
): Promise<Doc<"derivedOutputs">> => {
  const output = await ctx.db.get(id);
  if (!output || output.projectId !== scope.projectId) {
    throw new DerivedOutputsError("not-found", `Derived output not found: ${id}`);
  }
  return output;
};

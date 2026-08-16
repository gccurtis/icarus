import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { requireOutput } from "$derived-outputs/api/shared/require-output";
import { effectiveState } from "$derived-outputs/api/shared/staleness";
import type { DerivedOutput } from "$derived-outputs/types/derived-output";

/**
 * One output whole: its content, what produced it, and where that stood.
 *
 * **The state is folded here rather than read off the row.** `stale` is a
 * comparison between `inputsAt` and the same reading taken now, so it is
 * computed on the read that needs it — a stored flag would need every writer of
 * every input to know which outputs to mark.
 */
export const read = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"derivedOutputs">
): Promise<DerivedOutput> => {
  const output = await requireOutput(ctx, scope, id);

  return {
    id: output._id,
    prompt: output.prompt,
    scope: output.scope,
    inputs: output.inputs,
    block: output.block,
    state: await effectiveState(ctx, scope, output),
    error: output.error,
    model: output.model,
    inputsAt: output.inputsAt,
    latticeVersion: output.latticeVersion,
    refreshedAt: output.refreshedAt,
    createdBy: output.createdBy,
    updatedAt: output.updatedAt
  };
};

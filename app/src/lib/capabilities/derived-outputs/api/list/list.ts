import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { effectiveState } from "$derived-outputs/api/shared/staleness";
import type { DerivedOutputSummary } from "$derived-outputs/types/derived-output";

/**
 * The project's derived outputs, without their content.
 *
 * **The state is folded per output, and that is what this read is for.** "Which
 * of these need refreshing" is the question a directory of generated content
 * answers, and a list carrying the stored state would answer it with a marker
 * that is wrong for exactly the outputs it matters for. The cost is the declared
 * inputs of each output — a handful of indexed reads apiece, none of them a body.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<DerivedOutputSummary[]> => {
  const rows = await ctx.db
    .query("derivedOutputs")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  return await Promise.all(
    rows.map(async (output) => ({
      id: output._id,
      prompt: output.prompt,
      scope: output.scope,
      state: await effectiveState(ctx, scope, output),
      error: output.error,
      model: output.model,
      latticeVersion: output.latticeVersion,
      refreshedAt: output.refreshedAt,
      createdBy: output.createdBy,
      updatedAt: output.updatedAt,
      inputCount: output.inputs.length
    }))
  );
};

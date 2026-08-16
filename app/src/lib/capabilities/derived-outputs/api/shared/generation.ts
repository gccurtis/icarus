import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireOutput } from "$derived-outputs/api/shared/require-output";
import { inputRevisions } from "$derived-outputs/api/shared/staleness";
import { derivedBlock, type Generation } from "$derived-outputs/types/derived-output";

/**
 * Records a generation that succeeded: the content, and what its inputs were
 * when it ran.
 *
 * **`inputsAt` is read here rather than reported by the generator.** What the
 * output claims to have seen is then what the deployment can prove it saw, and
 * the reading is taken by the same function staleness compares against — two
 * readings of "what revision is this" that could disagree would make the
 * comparison meaningless.
 *
 * `refreshedAt` moves because this content is new. The error a previous attempt
 * left is cleared, because it described the attempt this one replaces.
 */
export const completeGeneration = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"derivedOutputs">,
  generation: Generation
): Promise<void> => {
  const output = await requireOutput(ctx, scope, id);
  const block = derivedBlock(generation.block);
  const at = Date.now();

  await ctx.db.patch(id, {
    block,
    inputsAt: await inputRevisions(ctx, scope, output.inputs),
    state: "fresh",
    error: undefined,
    // Both describe *this* generation, so a generator that names neither leaves
    // neither claimed rather than inheriting the last one's.
    model: generation.model,
    latticeVersion: generation.latticeVersion,
    refreshedAt: at,
    updatedAt: at
  });
};

/**
 * Records a generation that failed.
 *
 * **It does not touch `block`, `inputsAt`, or `refreshedAt`, and that is the
 * point.** An output that emptied itself on a failed refresh would turn a
 * transient provider outage into a hole in someone's report. What is shown is
 * whatever survived from before, dated when it was actually generated, and
 * `error` is what lets a reader be told the last attempt failed.
 */
export const failGeneration = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"derivedOutputs">,
  reason: string
): Promise<void> => {
  await requireOutput(ctx, scope, id);

  await ctx.db.patch(id, { state: "error", error: reason, updatedAt: Date.now() });
};

import type { Scope } from "$access/types/access";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireOutput } from "$derived-outputs/api/shared/require-output";
import type { GenerationRequest } from "$derived-outputs/types/derived-output";

/**
 * Asks for a regeneration: marks the output `generating` and returns everything
 * a generator needs to produce one.
 *
 * **Nothing is cleared.** The content stands until a generation replaces it, so
 * a reader keeps seeing the last good version, marked as being worked on. The
 * `error` goes because it described the attempt this one replaces, not because
 * the content it left behind is suspect.
 *
 * **`shaping` is passed through and never stored.** It is the prompt block's own
 * copy — the text as somebody has edited and is reading it — and it goes to the
 * generator as the shape to preserve, so a refresh updates the facts without
 * discarding the phrasing they chose. Writing it onto the output would lose the
 * canonical generated version, which is the other half of the pair and answers a
 * different question.
 *
 * The generation itself is not this capability's: a model call cannot run inside
 * a mutation. What follows is [`completeGeneration` or
 * `failGeneration`](../shared/shared.md), called by whatever ran it.
 */
export const refresh = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"derivedOutputs">,
  shaping?: ContentBlock
): Promise<GenerationRequest> => {
  const output = await requireOutput(ctx, scope, id);

  await ctx.db.patch(id, { state: "generating", error: undefined, updatedAt: Date.now() });

  return {
    outputId: id,
    prompt: output.prompt,
    scope: output.scope,
    inputs: output.inputs,
    shaping
  };
};

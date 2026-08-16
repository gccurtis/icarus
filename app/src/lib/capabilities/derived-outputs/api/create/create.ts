import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import {
  derivedInputs,
  derivedPrompt,
  emptyBlock,
  type DerivedOutputDraft
} from "$derived-outputs/types/derived-output";
import type { Actor } from "$shared/types/actor";

/**
 * Declares a derived output, and returns its id.
 *
 * **It declares and does not generate.** The row starts `idle` with an empty
 * block, because a declaration is a statement about what content should be
 * derived from and asking for it is [`refresh`](../refresh/refresh.md) — keeping
 * them apart is what lets an output be created inside a document edit without a
 * model call in the transaction.
 *
 * **`inputsAt` starts empty**, and that is not a placeholder: nothing has been
 * generated, so there is nothing this was generated from. The output is not
 * stale, it has never been fresh.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: DerivedOutputDraft
): Promise<Id<"derivedOutputs">> => {
  const prompt = derivedPrompt(draft.prompt);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("derivedOutputs", {
    projectId: scope.projectId,
    prompt,
    scope: draft.scope,
    inputs: derivedInputs(draft.inputs),
    block: emptyBlock(),
    state: "idle",
    inputsAt: [],
    createdBy: by,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "declared",
    target: { type: "derivedOutput", id, label: prompt }
  });

  return id;
};

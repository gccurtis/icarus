import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireMessage } from "$messages/api/finish/require-message";
import { MessagesError } from "$messages/errors";
import type { MessageOutcome } from "$messages/types/message";

/**
 * Closes a turn a responder was still producing.
 *
 * **The only write to a message after it is posted, and only while it is
 * streaming.** Messages are append-only, so finishing a settled turn is refused
 * rather than allowed to rewrite what somebody is recorded as having said.
 *
 * **`state` follows from `error`** instead of arriving beside it: two fields
 * could disagree about whether the turn worked, and one cannot. The blocks are
 * stored either way, because a turn that failed halfway still said something and
 * that is the record of how far it got.
 */
export const finish = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"messages">,
  outcome: MessageOutcome
): Promise<void> => {
  const message = await requireMessage(ctx, scope, id);
  if (message.state !== "streaming") {
    throw new MessagesError("not-streaming", `Message ${id} already ended as ${message.state}`);
  }

  await ctx.db.patch(id, {
    blocks: outcome.blocks,
    toolCalls: outcome.toolCalls,
    sources: outcome.sources,
    state: outcome.error === undefined ? "complete" : "error",
    error: outcome.error
  });
};

import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { messageAuthor, type MessageDraft } from "$messages/types/message";

/**
 * Appends one turn to a thread, and returns its id.
 *
 * **The turn names its thread; nothing names the turn.** A research thread, an
 * agent task, and a persona thread each *are* threads, so there is no
 * conversation row to create first and no pointer to write back.
 *
 * **The author rule is enforced here** rather than in the validator, because it
 * is a constraint between two fields: a prompt names who is asking, and a
 * response without an author means the thread's own responder.
 *
 * `streaming` opens a turn a responder is still producing; every other write to
 * the row is [`finish`](../finish/finish.md), and there is none after that.
 */
export const post = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: MessageDraft
): Promise<Id<"messages">> =>
  await ctx.db.insert("messages", {
    projectId: scope.projectId,
    thread: draft.thread,
    role: draft.role,
    blocks: draft.blocks,
    author: messageAuthor(draft.role, draft.author),
    mentions: draft.mentions,
    toolCalls: draft.toolCalls,
    sources: draft.sources,
    state: draft.streaming ? "streaming" : "complete"
  });

import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { messageRoleValidator, messageStateValidator } from "$messages/types/message";
import { messageSourceValidator } from "$messages/types/source";
import { threadRefValidator } from "$messages/types/thread";
import { toolCallValidator } from "$messages/types/tool-call";
import { actorValidator } from "$shared/types/actor";
import { mentionValidator } from "$shared/types/mention";

/**
 * Every turn in every conversation, in one table.
 *
 * **There is no `chats` table and no thread id on a thread.** A research thread,
 * an agent task, and a persona thread each *are* threads; `thread` names which
 * one, and `by_thread` is the whole link — one indexed read, with no field on
 * either side to keep in sync.
 *
 * **Messages are a table and blocks are not** for one reason: a conversation
 * grows without bound, and embedding turns would walk a thread into Convex's
 * document limit while rewriting the whole history on every reply. That is a
 * storage necessity, not an identity.
 *
 * **Append-only.** No `rank`, because order is `_creationTime`; no `revision`,
 * because changing a conversation is branching rather than editing, which leaves
 * the original intact.
 *
 * `by_project` leads the same column every index here does, and exists for the
 * work that crosses threads — export, deletion, retrieval — none of which can
 * walk one conversation at a time.
 */
export const messagesTables = {
  messages: defineTable({
    projectId: v.id("projects"),
    thread: threadRefValidator,
    role: messageRoleValidator,
    blocks: v.array(blockValidator),
    /** Required on a prompt, optional on a response — enforced by `post`. */
    author: v.optional(actorValidator),
    mentions: v.optional(v.array(mentionValidator)),
    toolCalls: v.optional(v.array(toolCallValidator)),
    sources: v.optional(v.array(messageSourceValidator)),
    state: messageStateValidator,
    error: v.optional(v.string())
  })
    .index("by_thread", ["projectId", "thread.kind", "thread.id"])
    .index("by_project", ["projectId"])
};

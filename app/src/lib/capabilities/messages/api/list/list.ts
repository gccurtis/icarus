import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { Message } from "$messages/types/message";
import type { ThreadRef } from "$messages/types/thread";

const asTurn = (row: Doc<"messages">): Message => ({
  id: row._id,
  role: row.role,
  blocks: row.blocks,
  author: row.author,
  mentions: row.mentions,
  toolCalls: row.toolCalls,
  sources: row.sources,
  state: row.state,
  error: row.error,
  at: row._creationTime
});

/**
 * One thread's turns, oldest first.
 *
 * **`by_thread(("research", id))` is the whole link** — one indexed read, with
 * no thread row to fetch first and no pointer on either side to keep in sync.
 * The discriminant is half the key because three tables mint ids into one
 * column and two of them may hand out the same one.
 *
 * **The message's own `projectId` decides access**, so this never joins upward
 * to a thread row to find out whether it was allowed to look — a check that has
 * to join upward is a check that will eventually forget to.
 *
 * No `.order()`: every row in the range shares all three index fields, so the
 * range is already `_creationTime` order, which is what append-only buys.
 */
export const list = async (
  ctx: QueryCtx,
  scope: Scope,
  thread: ThreadRef
): Promise<Message[]> => {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) =>
      q.eq("projectId", scope.projectId).eq("thread.kind", thread.kind).eq("thread.id", thread.id)
    )
    .collect();

  // `projectId` and `thread` stop here: a read is always of one thread, so
  // repeating which one per turn says nothing.
  return rows.map(asTurn);
};

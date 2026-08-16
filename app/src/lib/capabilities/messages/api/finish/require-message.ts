import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { MessagesError } from "$messages/errors";

/**
 * The turn that id names, or a refusal.
 *
 * **Not found, never forbidden.** One in another project answers exactly as one
 * that never existed; telling them apart confirms that a conversation about
 * something is happening. The gate proved the caller holds *a* project; this
 * proves the row is in it.
 */
export const requireMessage = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"messages">
): Promise<Doc<"messages">> => {
  const message = await ctx.db.get(id);
  if (!message || message.projectId !== scope.projectId) {
    throw new MessagesError("not-found", `Message not found: ${id}`);
  }
  return message;
};

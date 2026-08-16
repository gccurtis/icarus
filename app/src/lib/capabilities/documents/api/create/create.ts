import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { documentTitle } from "$documents/types/document";
import type { Actor } from "$shared/types/actor";

/**
 * Starts a document: a title, and no content at all.
 *
 * There is no body to write. A new document is a row and nothing else — pass 2's
 * first change set is what gives it one, so creating and opening are separate
 * writes rather than one that guesses at an empty body's shape.
 *
 * **The actor is built from the scope, never accepted.** An argument saying who
 * created this would let a caller sign someone else's name to it.
 *
 * The id is the return value because it is the one thing the caller cannot
 * already know; everything else it just wrote. Convex re-runs `list` for
 * everyone the moment this commits, so an echo would only be a staler copy.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  title: string,
  templateId?: string
): Promise<Id<"documents">> => {
  const named = documentTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("documents", {
    projectId: scope.projectId,
    title: named,
    templateId,
    createdBy: by,
    updatedBy: by,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "document", id, label: named }
  });

  return id;
};

import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { emptyDocumentBody, type DocumentBody } from "$documents/types/body";
import { documentTitle } from "$documents/types/document";
import { start } from "$revisions/api/shared/start";
import type { Actor } from "$shared/types/actor";

/**
 * Starts a document: a title, and a page with nothing on it.
 *
 * **The row and the anchor are written together**, because a document whose row
 * committed without one is a document nothing can open. What an empty body looks
 * like is decided here rather than there — nothing in revisions has ever
 * inspected a body.
 *
 * **The actor is built from the scope, never accepted.** An argument saying who
 * created this would let a caller sign someone else's name to it.
 *
 * `body` is the one a template supplies, and the empty one otherwise. It is
 * stored as given and never read, which is what makes instantiation a copy that
 * owes its template nothing.
 *
 * The id is the return value because it is the one thing the caller cannot
 * already know; everything else it just wrote. Convex re-runs `list` for
 * everyone the moment this commits, so an echo would only be a staler copy.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  title: string,
  templateId?: Id<"templates">,
  body?: DocumentBody
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

  await start(ctx, scope, { resourceType: "document", resourceId: id }, body ?? emptyDocumentBody());

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "document", id, label: named }
  });

  return id;
};

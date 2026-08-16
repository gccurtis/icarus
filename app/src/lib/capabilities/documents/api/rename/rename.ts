import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireDocument } from "$documents/api/shared/require-document";
import { documentTitle } from "$documents/types/document";
import type { Actor } from "$shared/types/actor";

/**
 * Gives a document a different name.
 *
 * A rename is the one edit that touches this row rather than appending a change
 * set, because the title is the only thing stored here — which is also why it
 * is a function of its own rather than a general `update`.
 *
 * The entry carries the *new* name, so the log reads as what happened. Past
 * entries keep the old one, which is right: they describe the document as it was
 * when they were written.
 */
export const rename = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"documents">,
  title: string
): Promise<void> => {
  await requireDocument(ctx, scope, id);
  const named = documentTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, { title: named, updatedBy: by, updatedAt: Date.now() });

  await record(ctx, scope, {
    actor: by,
    verb: "renamed",
    target: { type: "document", id, label: named }
  });
};

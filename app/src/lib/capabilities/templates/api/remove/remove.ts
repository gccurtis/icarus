import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireOwnTemplate } from "$templates/api/shared/require-own-template";

/**
 * Deletes a template.
 *
 * **Nothing made from it is touched, and nothing has to be.** A resource is a
 * full copy that records `templateId` as provenance alone, so the only loss is
 * the answer to "what was this made from" — which is why deleting a template is a
 * plain delete rather than the cascade a document's is.
 *
 * The name is read before the row goes, because the entry has to say which
 * template was deleted and there is nothing left to ask afterwards.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"templates">
): Promise<void> => {
  const { name } = await requireOwnTemplate(ctx, scope, id);

  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "deleted",
    target: { type: "template", id, label: name }
  });
};

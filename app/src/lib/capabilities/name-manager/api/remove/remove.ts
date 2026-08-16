import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { NameManagerError } from "$name-manager/errors";

/**
 * Takes a name out of the project's vocabulary, freeing it to be defined again.
 *
 * By id rather than by name: a caller holding a list holds ids, and a delete
 * addressed by a name is a delete that a concurrent redefinition can point
 * somewhere else.
 *
 * **The name is read before the row goes**, because the entry has to say what
 * was removed and there is nothing left to ask afterwards.
 *
 * **Not found, never forbidden.** A variable in another project answers exactly
 * as one that never existed.
 */
export const remove = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"nameVariables">
): Promise<void> => {
  const variable = await ctx.db.get(id);
  if (!variable || variable.projectId !== scope.projectId) {
    throw new NameManagerError("not-found", `Variable not found: ${id}`);
  }

  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId },
    verb: "removed",
    target: { type: "variable", id, label: variable.name }
  });
};

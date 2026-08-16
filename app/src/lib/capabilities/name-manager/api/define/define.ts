import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { canonicalValue } from "$name-manager/api/define/canonical-value";
import { canonicalName } from "$name-manager/api/shared/canonical-name";
import { findVariable } from "$name-manager/api/shared/find-variable";
import { NameManagerError } from "$name-manager/errors";
import type { VariableDefinition } from "$name-manager/types/variable";
import type { Actor } from "$shared/types/actor";

/**
 * Gives a value a name.
 *
 * **The name conflict is decided before the type and the value.** That ordering
 * is behaviour, not an implementation detail: an author correcting a typo in a
 * value should not be told their value is malformed when the real problem is
 * that the name is taken.
 *
 * **`(projectId, nameKey)` is unique and nothing in the database says so.**
 * Convex has no unique index, so this read-then-insert is the enforcement point
 * — safe because a Convex mutation is a serializable transaction: a concurrent
 * definition of the same name invalidates this one's read set and it re-runs
 * against the state that won. No retry loop and no version field, and exactly
 * one function may do it.
 */
export const define = async (
  ctx: MutationCtx,
  scope: Scope,
  input: VariableDefinition
): Promise<Id<"nameVariables">> => {
  const { name } = canonicalName(input.name);

  if (await findVariable(ctx, scope, name)) {
    throw new NameManagerError("name-conflict", `'${name}' already names something`);
  }

  const value = canonicalValue(input.declaredType, input.value);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("nameVariables", {
    projectId: scope.projectId,
    ...canonicalName(input.name),
    declaredType: input.declaredType,
    value,
    definitionOrder: await nextOrder(ctx, scope),
    createdBy: by,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "defined",
    target: { type: "variable", id, label: name }
  });

  return id;
};

/**
 * One past the project's highest.
 *
 * Read off the index rather than counted, and derived from the live maximum so a
 * removed variable's number is reused — which the ordering does not care about,
 * because nothing surviving moves.
 */
const nextOrder = async (ctx: MutationCtx, scope: Scope): Promise<number> => {
  const last = await ctx.db
    .query("nameVariables")
    .withIndex("by_project_and_order", (q) => q.eq("projectId", scope.projectId))
    .order("desc")
    .first();

  return (last?.definitionOrder ?? 0) + 1;
};

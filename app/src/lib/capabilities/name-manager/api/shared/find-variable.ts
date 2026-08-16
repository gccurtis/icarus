import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { asVariable } from "$name-manager/api/shared/as-variable";
import { canonicalName } from "$name-manager/api/shared/canonical-name";
import type { NameVariable } from "$name-manager/types/variable";

/**
 * The variable a name means in this project, in whatever spelling the caller
 * has.
 *
 * Promoted because it owns the canonicalization its callers must agree on:
 * `define` decides a name conflict with it and
 * [`formula`](../../../formula/api/evaluate/evaluate.ts) resolves a bare name
 * with it. If those two disagreed about what `Target Margin` keys to, a formula
 * would fail to find a variable whose name is already taken.
 *
 * Undefined rather than a refusal: not finding a name is the ordinary answer to
 * both questions, and each caller decides what it means.
 */
export const findVariable = async (
  ctx: QueryCtx,
  scope: Scope,
  name: string
): Promise<NameVariable | undefined> => {
  const { nameKey } = canonicalName(name);

  const row = await ctx.db
    .query("nameVariables")
    .withIndex("by_project_and_name_key", (q) =>
      q.eq("projectId", scope.projectId).eq("nameKey", nameKey)
    )
    .unique();

  return row ? asVariable(row) : undefined;
};

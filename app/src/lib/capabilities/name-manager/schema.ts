import { defineTable } from "convex/server";
import { v } from "convex/values";
import { valueTypeValidator, variableValueValidator } from "$name-manager/types/variable";
import { actorValidator } from "$shared/types/actor";

/**
 * The project's named values, and nothing about how any of them was arrived at.
 *
 * **Both forms of the name are stored.** `nameKey` is the lookup form and what
 * the uniqueness index is on; `name` is what the author typed. That is what
 * makes `TargetMargin`, `targetmargin`, and `Target Margin` one variable while a
 * person still sees their own casing — normalizing on read instead would put the
 * transformation in every lookup and leave no index able to serve one.
 *
 * `by_project_and_name_key` is unique, and Convex has no unique index: the
 * mutation maintains it, protected by serializable transactions.
 *
 * No expression, no dependency list, no resolution state. A variable holds a
 * value that arrived already computed.
 */
export const nameManagerTables = {
  nameVariables: defineTable({
    projectId: v.id("projects"),
    nameKey: v.string(),
    name: v.string(),
    declaredType: valueTypeValidator,
    value: variableValueValidator,
    /**
     * Monotonic per project. Creation time nearly works and is subtly wrong:
     * two variables defined in the same millisecond have no order, and a list
     * that reshuffles between reads is worse than an arbitrary but stable one.
     */
    definitionOrder: v.number(),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_project_and_name_key", ["projectId", "nameKey"])
    .index("by_project_and_order", ["projectId", "definitionOrder"])
};

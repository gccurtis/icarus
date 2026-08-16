import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";
import { setExpressionValidator } from "$shared/types/set-expression";

/**
 * A named group of resources, stored as the expression that selects them.
 *
 * **There is no member list here, and that is the whole model.** An enumerated
 * list captured on save would mean "the project as it was", and every set anyone
 * made would start decaying immediately. The expression is resolved when used,
 * so a document created tomorrow is already in `{ op: "project" }`.
 *
 * `revision` is the stale-form check: an expression is edited in a form somebody
 * has open, which no transaction covers.
 */
export const resourceSetsTables = {
  resourceSets: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    expression: setExpressionValidator,
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

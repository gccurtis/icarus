import { defineTable } from "convex/server";
import { v } from "convex/values";
import { personaDefinitionValidator } from "$personas/types/definition";
import { personaAvatarValidator } from "$personas/types/persona";
import { actorValidator } from "$shared/types/actor";
import { setExpressionValidator } from "$shared/types/set-expression";

/**
 * How an agent behaves — its instructions, its model, and what it may touch.
 *
 * **`projectId` is optional here, and it is still the first column of the only
 * index.** Absent means available to every project, the same reading
 * [`templates`](../templates/schema.ts) takes and for the same reasons: Convex
 * has no partial index, a sentinel is a value `v.id("projects")` cannot hold,
 * and a second table would make `personaId` a union of two id types everywhere.
 * A missing field indexes as `undefined` and sorts before every id, so the
 * globals are their own key range and neither range can reach another project's
 * rows.
 *
 * **A task references this row and does not copy it**, which is the opposite of
 * a template. A persona is an identity: someone looking at last week's task
 * wants to know who did it, not a frozen copy of an outdated configuration.
 *
 * `scope` is retrievable material and `definition.background` is inline
 * knowledge. Keeping them apart is the point of both fields existing.
 */
export const personasTables = {
  personas: defineTable({
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    description: v.optional(v.string()),
    definition: personaDefinitionValidator,
    /** Never rendered into the prompt — it widens what the work can find. */
    scope: v.optional(setExpressionValidator),
    /** A binding named in configuration, "agent" or "fast", never a model. */
    modelBinding: v.optional(v.string()),
    tools: v.array(v.string()),
    avatar: v.optional(personaAvatarValidator),
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

import { defineTable } from "convex/server";
import { v } from "convex/values";
import { resourceTypeValidator } from "$revisions/types/change";
import { actorValidator } from "$shared/types/actor";
import { templateBodyValidator } from "$templates/types/body";
import { templateSlotValidator } from "$templates/types/slot";

/**
 * A starting point for a resource, in the shape of the thing it makes.
 *
 * **`projectId` is optional here, and it is still the first column of the only
 * index.** Absent means available to every project. Convex has no partial index,
 * so the alternative readings were a sentinel id — a value `v.id("projects")`
 * cannot hold without giving up the reference — or a second table, which would
 * make `templateId` on a resource a union of two id types and every reader
 * choose between them.
 *
 * Leaving the column optional keeps one table and one index, and costs one thing:
 * a read must say which range it wants. A missing field indexes as `undefined`
 * and sorts before every id, so the globals are their own key range —
 * `eq("projectId", undefined)` is exactly them and `eq("projectId", mine)` is
 * exactly mine. Neither range can reach another project's rows, which is the
 * property the projectId-leads rule exists for.
 *
 * **The body is on the row**, unlike a document's. A template is not
 * collaboratively edited — it is replaced wholesale by whoever owns it — so there
 * is no per-keystroke write to amplify and no undo to reach into. `revision` is
 * the stale-form check that makes that replacement safe.
 */
export const templatesTables = {
  templates: defineTable({
    projectId: v.optional(v.id("projects")),
    name: v.string(),
    description: v.optional(v.string()),
    /** Written from `body.target`, never accepted, so the two cannot disagree. */
    target: resourceTypeValidator,
    body: templateBodyValidator,
    slots: v.array(templateSlotValidator),
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

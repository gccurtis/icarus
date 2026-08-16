import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorLabelValidator, referenceValidator } from "$activity/types/activity";
import { actorValidator } from "$shared/types/actor";

/**
 * What happened in a project, in order. One append-only row per event.
 *
 * **The labels are stored, not joined.** An entry has to read correctly after
 * its subject is deleted — "deleted a document" with no name is not an audit
 * record — and rendering a hundred entries should be one query rather than a
 * hundred lookups across a dozen tables. A label is therefore a snapshot: a
 * renamed document keeps its old name in past entries, which is right, because
 * they describe what happened when it happened.
 *
 * `by_project` carries no second field. A feed is read as one range newest
 * first, so the index exists to keep that read inside one project rather than to
 * answer a narrower question; filtering by actor or verb is a predicate over a
 * range that is already small.
 */
export const activityTables = {
  activity: defineTable({
    projectId: v.id("projects"),
    actor: actorValidator,
    actorLabel: actorLabelValidator,
    /** "created", "updated", "synced", "resolved". */
    verb: v.string(),
    target: referenceValidator,
    context: v.optional(referenceValidator),
    detail: v.optional(v.string()),
    at: v.number()
  }).index("by_project", ["projectId"])
};

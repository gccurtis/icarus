import { defineTable } from "convex/server";
import { v } from "convex/values";
import { resourceBodyValidator } from "$revisions/types/body";
import { opValidator, resourceTypeValidator } from "$revisions/types/change";
import { actorValidator } from "$shared/types/actor";

/**
 * A general resource's content: anchor bodies plus an append-only log of what
 * changed. Current content is the `leader` snapshot with the `recent` sets after
 * it applied.
 *
 * **`(resourceType, resourceId)` is the full key, always.** Never the id alone —
 * two resources of different kinds may carry the same id. `projectId` leads the
 * pair rather than the pair leading, so a read that names one field too few
 * ranges over one project instead of the deployment; the equality costs nothing,
 * since a prefix of equalities is the same contiguous B-tree scan either way.
 *
 * **The resource row has no revision.** Current revision is the highest change
 * set revision, read from an index. Storing it would make every edit patch the
 * resource, and a Convex patch rewrites the whole document including the body —
 * so a keystroke batch would cost the size of the deck.
 */
export const revisionsTables = {
  changeSets: defineTable({
    projectId: v.id("projects"),
    resourceType: resourceTypeValidator,
    resourceId: v.string(),
    revision: v.number(),
    /** Kept beside `revision` to ask "has anything conflicting changed", not "has anything". */
    baseRevision: v.number(),
    /**
     * Which side of the consolidation boundary the set sits on. A field rather
     * than two tables, so consolidation is a flag flip rather than a copy, and
     * reconstructing a revision spanning the boundary is one indexed range read.
     */
    tier: v.union(v.literal("recent"), v.literal("historical")),
    ops: v.array(opValidator),
    /**
     * The deepest id each op addresses, never its ancestors. Two people editing
     * different atoms of one paragraph would both list the block if ancestors
     * were included, and they do not conflict.
     */
    touched: v.array(v.string()),
    actor: actorValidator,
    at: v.number()
  })
    .index("by_resource_state", ["projectId", "resourceType", "resourceId", "tier", "revision"])
    .index("by_resource_revision", ["projectId", "resourceType", "resourceId", "revision"]),

  resourceSnapshots: defineTable({
    projectId: v.id("projects"),
    resourceType: resourceTypeValidator,
    resourceId: v.string(),
    revision: v.number(),
    /** `leader` anchors the hot read and `base` the cold one; a checkpoint only bounds replay. */
    role: v.union(v.literal("base"), v.literal("leader"), v.literal("checkpoint")),
    /** One of the three resources' bodies; the column beside it says which. */
    body: resourceBodyValidator,
    at: v.number()
  }).index("by_resource_role", ["projectId", "resourceType", "resourceId", "role"])
};

import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A deck's metadata. The body — theme, layouts, slides — is a leader snapshot
 * plus a change-set log, for the reason a document's is: a Convex patch rewrites
 * the whole row, and a deck carries embedded images and per-element layout, so
 * it is the resource where write amplification hurts most.
 *
 * **`aspectRatio` is the one piece of appearance that stays here.** A thumbnail
 * needs it before anything opens the body, and no edit operation changes it —
 * frames are fractions of the slide, so they only mean the same thing across
 * slides if the slides are the same shape.
 *
 * `templateId` is `v.string()` until `templates` exists in pass 3.
 */
export const slideDecksTables = {
  slideDecks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    aspectRatio: v.union(v.literal("16:9"), v.literal("4:3")),
    templateId: v.optional(v.string()),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

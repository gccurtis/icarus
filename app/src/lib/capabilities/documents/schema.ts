import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A document's metadata, and deliberately nothing else.
 *
 * **The body is not here, and neither is a revision.** A Convex patch rewrites
 * the whole document, so a body on this row would be rewritten in full on every
 * edit, and a revision counter would force that same rewrite for a
 * one-character change. Both arrive in pass 2 as a leader snapshot plus an
 * append-only change-set log, where an edit is one small insert and this row is
 * not touched at all.
 *
 * What remains is what a document list, a tab, a breadcrumb, and a search result
 * render from — readable without loading a word of content.
 *
 * `templateId` is `v.string()` because `templates` does not exist until pass 3;
 * tightening it to `v.id("templates")` is a step in the task that creates it. It
 * is provenance only — a document is a full copy from creation, so changing the
 * template later changes nothing here.
 */
export const documentsTables = {
  documents: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    templateId: v.optional(v.string()),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

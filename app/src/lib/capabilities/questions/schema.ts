import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { questionStatusValidator } from "$questions/types/question";
import { actorValidator } from "$shared/types/actor";

/**
 * The unit of inquiry: what the project is trying to find out.
 *
 * **`text` is plain and `notes` are blocks.** The question is one sentence and it
 * is the label lists, breadcrumbs, and search results render; the surrounding
 * context — what has been ruled out, the screenshot that prompted it — is
 * genuinely rich.
 *
 * **No columns for hypotheses or findings.** Both attach through research links,
 * both many-to-many, and a key here would force someone to pick the one it
 * "really" belongs to and lose the rest.
 *
 * **`by_parent` leads with the project**, like every index here, so reading one
 * question's children cannot stray into another project's tree.
 *
 * `revision` is the stale-form check: `notes` are edited in a form over minutes,
 * which no transaction covers.
 */
export const questionsTables = {
  questions: defineTable({
    projectId: v.id("projects"),
    text: v.string(),
    notes: v.array(blockValidator),
    status: questionStatusValidator,
    /** One parent, absent at the root. The tree need not be balanced or complete. */
    parentId: v.optional(v.id("questions")),
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["projectId", "parentId"])
};

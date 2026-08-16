import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { Question } from "$questions/types/question";

// `projectId` stops here: every question returned is from the project that was
// asked about, so repeating it per row says nothing.
const asQuestion = (row: Doc<"questions">): Question => ({
  id: row._id,
  text: row.text,
  notes: row.notes,
  status: row.status,
  parentId: row.parentId,
  createdBy: row.createdBy,
  revision: row.revision,
  updatedAt: row.updatedAt
});

/**
 * The project's questions, or one question's children.
 *
 * **The whole project is the default rather than the roots.** A tree view builds
 * itself from the flat list it already holds, and the alternative — a read per
 * level — is a round trip for every branch someone opens.
 *
 * `by_parent` is what makes the narrow form one indexed range, and it is the form
 * a sub-question picker uses, where the rest of the tree is noise.
 */
export const list = async (
  ctx: QueryCtx,
  scope: Scope,
  parentId?: Id<"questions">
): Promise<Question[]> => {
  const rows = parentId
    ? await ctx.db
        .query("questions")
        .withIndex("by_parent", (q) =>
          q.eq("projectId", scope.projectId).eq("parentId", parentId)
        )
        .collect()
    : await ctx.db
        .query("questions")
        .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
        .collect();

  return rows.map(asQuestion);
};

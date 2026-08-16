import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { Hypothesis } from "$hypotheses/types/hypothesis";

// `projectId` stops here: every hypothesis returned is from the project that was
// asked about, so repeating it per row says nothing.
const asHypothesis = (row: Doc<"hypotheses">): Hypothesis => ({
  id: row._id,
  statement: row.statement,
  rationale: row.rationale,
  assessment: row.assessment,
  confidence: row.confidence,
  createdBy: row.createdBy,
  updatedBy: row.updatedBy,
  revision: row.revision,
  updatedAt: row.updatedAt
});

/**
 * The project's hypotheses.
 *
 * **All of them, attached to a question or not.** `projectId` is on the row
 * rather than reached through a question, which is exactly what keeps a hunch
 * nobody has filed yet inside this read instead of stranded outside every query.
 *
 * The ones bearing on a particular question are a research link read, and that
 * belongs to links rather than here.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<Hypothesis[]> => {
  const rows = await ctx.db
    .query("hypotheses")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  return rows.map(asHypothesis);
};

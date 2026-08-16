import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { asLink } from "$research-links/api/shared/as-link";
import type { LinkBearer, ResearchLink } from "$research-links/types/research-link";

/**
 * What one finding or hypothesis speaks to, in one indexed read.
 *
 * The other direction of the same edges, and the reason the relationship is a
 * table rather than a column: one piece of evidence routinely answers more than
 * one thing being asked, and a `questionId` on the finding would force somebody
 * to pick the one it "really" belongs to and lose the rest.
 *
 * No kind filter, unlike [`bearers`](../bearers/bearers.md): what a bearer speaks
 * to is one list, and the hypotheses and questions in it are read together.
 */
export const subjects = async (
  ctx: QueryCtx,
  scope: Scope,
  bearer: LinkBearer
): Promise<ResearchLink[]> => {
  const rows = await ctx.db
    .query("researchLinks")
    .withIndex("by_bearer", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("bearerKind", bearer.bearerKind)
        .eq("bearerId", bearer.bearerId)
    )
    .collect();

  return rows.map(asLink);
};

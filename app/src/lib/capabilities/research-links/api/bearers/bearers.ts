import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { asLink } from "$research-links/api/shared/as-link";
import type {
  LinkBearerKind,
  LinkSubject,
  ResearchLink
} from "$research-links/types/research-link";

/**
 * Everything bearing on one question or hypothesis, in one indexed read.
 *
 * This is three of the four readings the model promises: the hypotheses proposed
 * for a question, the findings bearing on that same question, and the evidence
 * for a hypothesis with each finding's `bearing` on it.
 *
 * **`bearerKind` filters what was read rather than what was indexed.** A
 * question's two lists — proposals and evidence — render separately, and the
 * fan-in on one question is small enough that a fourth index column would buy
 * nothing over a filter across rows already in memory.
 */
export const bearers = async (
  ctx: QueryCtx,
  scope: Scope,
  subject: LinkSubject,
  bearerKind?: LinkBearerKind
): Promise<ResearchLink[]> => {
  const rows = await ctx.db
    .query("researchLinks")
    .withIndex("by_subject", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("subjectKind", subject.subjectKind)
        .eq("subjectId", subject.subjectId)
    )
    .collect();

  return rows.filter((row) => !bearerKind || row.bearerKind === bearerKind).map(asLink);
};

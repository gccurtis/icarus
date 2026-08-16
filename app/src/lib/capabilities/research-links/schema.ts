import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  linkBearerKindValidator,
  linkBearingValidator,
  linkSubjectKindValidator
} from "$research-links/types/research-link";
import { actorValidator } from "$shared/types/actor";

/**
 * The edges between questions, hypotheses, and findings. All three relationships
 * are many-to-many, and all three run through this one table.
 *
 * **`bearing` is here rather than on the finding, and that is the whole reason
 * the table exists.** Supporting is something a finding does *toward a
 * hypothesis*, not a property it has: on the edge the same finding supports one
 * explanation and contradicts another, which a column on the row could say only
 * one of at a time.
 *
 * **An endpoint is `(kind, id)` with the id a plain string.** The kind names the
 * table; a union of `v.id`s would make every reader choose a branch to render
 * one list, and the pair is the key either way.
 *
 * **Every index leads with `projectId`, ahead of the pair it is named for.** A
 * link never crosses projects — `link` proves both endpoints sit in the caller's
 * — so the prefix costs no query and makes a forgotten predicate a narrower read
 * rather than every project's edges.
 *
 * `by_bearer` is a prefix of `by_bearer_subject` and is declared anyway: a read
 * naming the index it means is a read that keeps meaning it after the wider one
 * is retuned for the duplicate check.
 *
 * **There is no `rank` and no timestamp.** Ordering evidence is a view concern,
 * and recency is `_creationTime`.
 */
export const researchLinksTables = {
  researchLinks: defineTable({
    projectId: v.id("projects"),
    bearerKind: linkBearerKindValidator,
    bearerId: v.string(),
    subjectKind: linkSubjectKindValidator,
    subjectId: v.string(),
    /** Findings only. A hypothesis addressing a question is a proposal, not evidence. */
    bearing: v.optional(linkBearingValidator),
    /** A sentence of justification. Anything longer is a finding. */
    note: v.optional(v.string()),
    createdBy: actorValidator
  })
    .index("by_bearer", ["projectId", "bearerKind", "bearerId"])
    .index("by_subject", ["projectId", "subjectKind", "subjectId"])
    .index("by_bearer_subject", [
      "projectId",
      "bearerKind",
      "bearerId",
      "subjectKind",
      "subjectId"
    ])
};

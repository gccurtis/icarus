import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { findingSourceValidator } from "$findings/types/finding";
import { actorValidator } from "$shared/types/actor";

/**
 * Something established, written down with what establishes it.
 *
 * **No `questionId`, no `hypothesisId`, and no `bearing`.** All three are
 * research links, because all three relationships are many-to-many: one finding
 * supports one explanation while undercutting another, and a `bearing` column
 * here could say only one of those at a time. A finding also needs no attachment
 * at all — research turns up things nobody was looking for.
 *
 * **`body` is blocks rather than document rows.** A finding has no page, no
 * margins, and no side-by-side layout; it is read inline wherever it is cited.
 * It is a list rather than one block because a block holds no newlines and a
 * finding is a writeup — a claim, the evidence, a caveat.
 *
 * **`sources` sit on the row and carry their own excerpt.** The citation is part
 * of the finding, and the copy is what keeps it checkable after the page it came
 * from changes.
 *
 * There is no snapshot and no change-set log: a finding has no edit history, and
 * `revision` is the stale-form check rather than a pointer into one.
 */
export const findingsTables = {
  findings: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    body: v.array(blockValidator),
    sources: v.array(findingSourceValidator),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

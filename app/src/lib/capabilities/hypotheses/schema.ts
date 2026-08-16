import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { hypothesisAssessmentValidator } from "$hypotheses/types/hypothesis";
import { actorValidator } from "$shared/types/actor";

/**
 * A proposed answer, stated so that evidence can bear on it.
 *
 * **There is no `questionId`.** Questions attach through research links, and the
 * relationship is many-to-many: one claim bears on several questions at once, and
 * duplicating it to attach it twice would make two things that must be assessed
 * together and cannot be. A hypothesis also needs no question at all — a hunch
 * arrives before the question it belongs to is articulated.
 *
 * **`projectId` is stored directly rather than reached through a question**, which
 * is what keeps an unattached hypothesis inside every query rather than stranded
 * outside them.
 *
 * **`assessment` is stored, never derived** from the findings that link here. A
 * count of supporting versus contradicting findings is not a judgement — three
 * weak findings do not outweigh one decisive one — and a column computed from
 * them would assert a confidence nobody chose.
 *
 * `confidence` is optional for the same reason: an untested claim has none to
 * report, and a default would be a fabricated number.
 */
export const hypothesesTables = {
  hypotheses: defineTable({
    projectId: v.id("projects"),
    statement: v.string(),
    rationale: v.array(blockValidator),
    assessment: hypothesisAssessmentValidator,
    /** 0–1, and only once there is an assessment to attach it to. */
    confidence: v.optional(v.number()),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};

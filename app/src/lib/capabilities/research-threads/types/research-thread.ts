import { v, type Infer } from "convex/values";
import type { Id } from "$convex/_generated/dataModel";
import { ResearchThreadsError } from "$research-threads/errors";
import type { Actor } from "$shared/types/actor";

/**
 * What the thread is working toward — not how attached it is.
 *
 * **`discover` is looking for things.** The thread is driven by its prompt rather
 * than by a specific question or hypothesis, which is a different job rather than
 * a missing anchor: discovery is how questions get found in the first place, and
 * a discover thread producing a finding is the normal case.
 *
 * `question` and `hypothesis` are pointed at something, and the matching id is
 * what puts the thread in context on the object it belongs to.
 */
export const researchThreadModeValidator = v.union(
  v.literal("discover"),
  v.literal("question"),
  v.literal("hypothesis")
);

export type ResearchThreadMode = Infer<typeof researchThreadModeValidator>;

/**
 * What a thread is about, as direct ids rather than research links.
 *
 * A thread is about *one* thing — `mode` says which — so the relationship is
 * one-to-one, and routing it through the many-to-many table would make every
 * thread read a join to answer something it already knows.
 */
export type ResearchAnchor = {
  readonly questionId?: Id<"questions">;
  readonly hypothesisId?: Id<"hypotheses">;
};

/** A thread as a list or a context panel renders it. `projectId` stops at the read. */
export type ResearchThread = ResearchAnchor & {
  readonly id: Id<"researchThreads">;
  readonly title: string;
  readonly mode: ResearchThreadMode;
  readonly createdBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/** Everything a thread is stated as. `start` and `revise` take the same shape. */
export type ResearchThreadDraft = ResearchAnchor & {
  readonly title: string;
  readonly mode: ResearchThreadMode;
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * It is what every list, breadcrumb, and mention of the thread renders, and none
 * of them load a message to do it — so a thread titled with spaces is a row
 * nobody can pick out anywhere it appears.
 */
export const researchThreadTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ResearchThreadsError("empty-title", "A thread has to say what it is working on");
  }
  return trimmed;
};

/** The set is read off the validator so the two cannot drift into disagreeing. */
const modes = new Set<string>(researchThreadModeValidator.members.map((member) => member.value));

/** Which id each mode is anchored by. `discover` is anchored by neither. */
const anchorOf = {
  discover: undefined,
  question: "questionId",
  hypothesis: "hypothesisId"
} as const;

/**
 * The stored form of an anchor, which the schema cannot state because it is a
 * constraint between the mode and two other fields.
 *
 * **`discover` carries no anchor and that is the mode, not a gap.** A thread
 * looking for things is not a question thread missing its question, so an anchor
 * on one is refused rather than kept — it would make `mode` and the ids two
 * statements free to disagree.
 *
 * The unnamed side is refused rather than dropped, because dropping it would
 * store a thread about something other than what the caller said.
 */
export const researchThreadAnchor = (
  mode: ResearchThreadMode,
  anchor: ResearchAnchor
): ResearchAnchor => {
  if (!modes.has(mode)) {
    throw new ResearchThreadsError("unknown-mode", `A thread does not work in ${mode} mode`);
  }

  const named = anchorOf[mode];
  for (const field of ["questionId", "hypothesisId"] as const) {
    if (anchor[field] !== undefined && field !== named) {
      throw new ResearchThreadsError(
        "mismatched-anchor",
        `A ${mode} thread is not anchored by ${field}`
      );
    }
  }
  if (named !== undefined && anchor[named] === undefined) {
    throw new ResearchThreadsError("missing-anchor", `A ${mode} thread is about a ${mode}`);
  }

  return { questionId: anchor.questionId, hypothesisId: anchor.hypothesisId };
};

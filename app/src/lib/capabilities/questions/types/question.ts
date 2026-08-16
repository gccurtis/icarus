import { v, type Infer } from "convex/values";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import { QuestionsError } from "$questions/errors";
import type { Actor } from "$shared/types/actor";

/**
 * Where a question stands. Three values, describing the state of the work rather
 * than what was learned — conclusions are findings, not a status.
 *
 * **There is no `parked`.** A question nobody intends to pursue is deleted:
 * keeping it in a state meaning "we are not doing this" fills the list with
 * things that look like work and are not, and the honest signal is its absence.
 * `open` already covers a question that is waiting.
 */
export const questionStatusValidator = v.union(
  v.literal("open"),
  v.literal("investigating"),
  v.literal("answered")
);

export type QuestionStatus = Infer<typeof questionStatusValidator>;

/**
 * A question as a list, a breadcrumb, or a tree renders it.
 *
 * No arrays of hypotheses or findings: both attach through research links and
 * both are many-to-many, so a column here would force someone to pick the one it
 * "really" belongs to. `parentId` stays a direct field because a question has
 * exactly one parent — a decomposition producing two would be two questions.
 */
export type Question = {
  readonly id: Id<"questions">;
  readonly text: string;
  readonly notes: ContentBlock[];
  readonly status: QuestionStatus;
  readonly parentId?: Id<"questions">;
  readonly createdBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/** Everything a question is authored as. `ask` and `revise` take the same shape. */
export type QuestionDraft = {
  readonly text: string;
  readonly notes: ContentBlock[];
  /** Absent means the root — on `revise` that is a move, not "unchanged". */
  readonly parentId?: Id<"questions">;
};

/**
 * The stored form of a question: trimmed, and never empty.
 *
 * `text` is plain rather than blocks because a question is one sentence, and it
 * is the label everything else renders — a blank one is a row nobody can read
 * anywhere it appears.
 */
export const questionText = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new QuestionsError("empty-text", "A question has to ask something");
  }
  return trimmed;
};

/** The set is read off the validator so the two cannot drift into disagreeing. */
const statuses = new Set<string>(questionStatusValidator.members.map((member) => member.value));

/**
 * The stored form of a status.
 *
 * The door's validator already refuses `parked`, and this refuses it one step
 * further in — so a caller inside the deployment cannot park a question either,
 * and the answer is a stated refusal rather than a schema fault.
 */
export const questionStatus = (status: QuestionStatus): QuestionStatus => {
  if (!statuses.has(status)) {
    throw new QuestionsError("unknown-status", `A question is not ${status}`);
  }
  return status;
};

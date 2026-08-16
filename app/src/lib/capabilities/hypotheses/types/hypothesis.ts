import { v, type Infer } from "convex/values";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import { HypothesesError } from "$hypotheses/errors";
import type { Actor } from "$shared/types/actor";

/**
 * The judgement on a claim.
 *
 * Five values splitting into three states of *work* — `untested`, `testing`,
 * done — and three *verdicts* once done. One field rather than two, because a
 * verdict implies the work happened, so most of the combinations a second field
 * would allow are nonsense.
 *
 * **`testing` is why work in progress does not read as nobody having started**,
 * and **`inconclusive` is a real outcome**: it records that the work was done and
 * did not settle the question, which `untested` would erase.
 */
export const hypothesisAssessmentValidator = v.union(
  v.literal("untested"),
  v.literal("testing"),
  v.literal("supported"),
  v.literal("refuted"),
  v.literal("inconclusive")
);

export type HypothesisAssessment = Infer<typeof hypothesisAssessmentValidator>;

/**
 * A hypothesis as a list renders it: the claim, its judgement, and the argument
 * behind it.
 *
 * No question, and no findings. Both attach through research links, and the
 * relationship with a question is many-to-many — a claim about pricing power
 * bears on "why did margin fall" and "should we raise prices" at once.
 */
export type Hypothesis = {
  readonly id: Id<"hypotheses">;
  readonly statement: string;
  readonly rationale: ContentBlock[];
  readonly assessment: HypothesisAssessment;
  /** 0–1, and absent until there is an assessment to attach it to. */
  readonly confidence?: number;
  readonly createdBy: Actor;
  readonly updatedBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/** Everything a hypothesis is authored as. `propose` and `revise` take the same shape. */
export type HypothesisDraft = {
  readonly statement: string;
  readonly rationale: ContentBlock[];
};

/**
 * The stored form of a claim: trimmed, and never empty.
 *
 * `statement` is plain rather than blocks because it has to read cleanly next to
 * its assessment in a list. The argument for it is `rationale`, which wants
 * structure.
 */
export const hypothesisStatement = (statement: string): string => {
  const trimmed = statement.trim();
  if (trimmed.length === 0) {
    throw new HypothesesError("empty-statement", "A hypothesis has to claim something");
  }
  return trimmed;
};

/** The set is read off the validator so the two cannot drift into disagreeing. */
const assessments = new Set<string>(
  hypothesisAssessmentValidator.members.map((member) => member.value)
);

/**
 * The stored form of an assessment.
 *
 * The door's validator already refuses an unlisted value; this refuses it one
 * step further in, so the answer is a stated refusal rather than a schema fault.
 */
export const hypothesisAssessment = (
  assessment: HypothesisAssessment
): HypothesisAssessment => {
  if (!assessments.has(assessment)) {
    throw new HypothesesError("unknown-assessment", `A hypothesis is not ${assessment}`);
  }
  return assessment;
};

/**
 * The stored form of a confidence, which is `undefined` more often than not.
 *
 * **Nothing defaults it.** A hypothesis nobody has tested has no confidence to
 * report, and a `0` or a `0.5` would be a fabricated number that charts and
 * summaries consume as though somebody chose it.
 *
 * Moving back to `untested` therefore clears the number rather than keeping one
 * that no longer stands for anything.
 */
export const hypothesisConfidence = (
  assessment: HypothesisAssessment,
  confidence: number | undefined
): number | undefined => {
  if (confidence === undefined) return undefined;
  if (assessment === "untested") {
    throw new HypothesesError(
      "confidence-untested",
      "An untested hypothesis has no confidence to report"
    );
  }
  if (confidence < 0 || confidence > 1) {
    throw new HypothesesError("confidence-range", `A confidence of ${confidence} is not a probability`);
  }
  return confidence;
};

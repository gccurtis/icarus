import type { Actor } from "$json-store/types/core/actor";
import type { Id } from "$json-store/types/core/id";

/**
 * The judgement on a claim. Three states of work — `untested`, `testing`, done —
 * and three verdicts once done.
 *
 * `inconclusive` is a real outcome: the work happened and did not settle the
 * question, which `untested` would erase.
 */
export type HypothesisAssessment =
  | "untested"
  | "testing"
  | "supported"
  | "refuted"
  | "inconclusive";

/** `neutral` is not "unknown": the evidence was assessed and moves neither way. */
export type Bearing = "supports" | "refutes" | "neutral";

/**
 * One finding bearing on a claim. The bearing lives here and nowhere else, so
 * the judgement has one home and cannot disagree with a copy.
 *
 * This edge carries attribution and a revision where a `RelatedItem` does not,
 * because it has editable content.
 */
export type HypothesisEvidence = {
  findingId: Id<"findings">;
  bearing: Bearing;
  /** A sentence of justification. Anything longer is a finding. */
  note?: string;
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
};

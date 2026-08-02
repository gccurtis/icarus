import type {
  ActorId,
  Finding,
  FindingFilter,
  Hypothesis,
  HypothesisFilter,
  IsoTimestamp,
  Question,
  QuestionFilter
} from "../domain/model.js";

/**
 * Project-local persistence for all Investigation record types.
 * Implementations exclude soft-deleted records from ordinary reads and lists.
 */
export interface InvestigationStore {
  insertQuestion(question: Question): void;
  getQuestion(id: string): Question | undefined;
  listQuestions(filter?: QuestionFilter): Question[];
  updateQuestion(question: Question): void;
  softDeleteQuestion(
    id: string,
    updatedBy: ActorId,
    deletedAt: IsoTimestamp
  ): void;

  insertHypothesis(hypothesis: Hypothesis): void;
  getHypothesis(id: string): Hypothesis | undefined;
  listHypotheses(filter?: HypothesisFilter): Hypothesis[];
  updateHypothesis(hypothesis: Hypothesis): void;
  softDeleteHypothesis(
    id: string,
    updatedBy: ActorId,
    deletedAt: IsoTimestamp
  ): void;

  insertFinding(finding: Finding): void;
  getFinding(id: string): Finding | undefined;
  listFindings(filter?: FindingFilter): Finding[];
  updateFinding(finding: Finding): void;
  softDeleteFinding(
    id: string,
    updatedBy: ActorId,
    deletedAt: IsoTimestamp
  ): void;

  /**
   * Atomically accepts a live Finding only while its persisted claim still
   * matches the text most recently admitted to Knowledge.
   */
  acceptFindingIfClaimMatches(
    id: string,
    expectedClaim: string,
    knowledgeSourceId: string,
    updatedBy: ActorId,
    updatedAt: IsoTimestamp
  ): boolean;
}

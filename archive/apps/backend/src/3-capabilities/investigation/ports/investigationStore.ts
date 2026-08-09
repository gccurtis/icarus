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
 * Current tables contain only live records; history is retained separately.
 */
export interface InvestigationStore {
  insertQuestion(question: Question): void;
  getQuestion(id: string): Question | undefined;
  listQuestions(filter?: QuestionFilter): Question[];
  updateQuestion(question: Question): void;
  deleteQuestion(question: Question, deletedAt: string): void;

  insertHypothesis(hypothesis: Hypothesis): void;
  getHypothesis(id: string): Hypothesis | undefined;
  listHypotheses(filter?: HypothesisFilter): Hypothesis[];
  updateHypothesis(hypothesis: Hypothesis): void;
  deleteHypothesis(hypothesis: Hypothesis, deletedAt: string): void;

  insertFinding(finding: Finding): void;
  getFinding(id: string): Finding | undefined;
  listFindings(filter?: FindingFilter): Finding[];
  updateFinding(finding: Finding): void;
  deleteFinding(finding: Finding, deletedAt: string): void;

  purge(resourceKind: "question" | "hypothesis" | "finding", id: string): void;
  pruneHistory(cutoff: string): number;
  expiredDeleted(cutoff: string): Array<{
    resourceKind: "question" | "hypothesis" | "finding";
    resourceId: string;
  }>;

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

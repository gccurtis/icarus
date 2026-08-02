export const QUESTION_STATUSES = ["open", "proposed", "answered"] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const HYPOTHESIS_STATUSES = [
  "proposed",
  "accepted",
  "refuted",
  "inconclusive"
] as const;

export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export const HYPOTHESIS_CONFIDENCE_LEVELS = [
  "strongly_refuted",
  "weakly_refuted",
  "uncertain",
  "weakly_supported",
  "strongly_supported"
] as const;

export type HypothesisConfidenceLevel =
  (typeof HYPOTHESIS_CONFIDENCE_LEVELS)[number];

export const FINDING_STATUSES = ["proposed", "accepted", "rejected"] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_RELATIONSHIPS = [
  "supports",
  "refutes",
  "qualifies",
  "contextualizes"
] as const;

export type FindingRelationship = (typeof FINDING_RELATIONSHIPS)[number];

export type ActorId = string;
export type IsoTimestamp = string;

export interface Question {
  readonly id: string;
  readonly text: string;
  readonly context?: string;
  readonly currentAnswer?: string;
  readonly assumptions: readonly string[];
  readonly status: QuestionStatus;
  readonly tags: readonly string[];
  readonly revision: number;
  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface Hypothesis {
  readonly id: string;
  readonly questionIds: readonly string[];
  readonly statement: string;
  readonly rationale?: string;
  readonly assumptions: readonly string[];
  readonly status: HypothesisStatus;
  readonly confidenceLevel?: HypothesisConfidenceLevel;
  readonly revision: number;
  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface FindingQuestionLink {
  readonly questionId: string;
  /** Omit when the Finding is relevant to the Question but unclassified. */
  readonly relationship?: FindingRelationship;
}

export interface FindingHypothesisLink {
  readonly hypothesisId: string;
  /** Omit when the Finding is relevant to the Hypothesis but unclassified. */
  readonly relationship?: FindingRelationship;
}

export type FindingReferenceSpan =
  | {
      readonly kind: "characters";
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "lines";
      readonly startLine: number;
      readonly endLine: number;
    };

export type FindingReference =
  | {
      readonly kind: "resource";
      readonly resourceKind: string;
      readonly resourceId: string;
      readonly locator?: string;
      readonly resourceRevision?: number | string;
      readonly span?: FindingReferenceSpan;
      readonly note?: string;
      readonly needsReview?: boolean;
    }
  | {
      readonly kind: "url";
      readonly href: string;
      readonly observedAt: IsoTimestamp;
      readonly span?: FindingReferenceSpan;
      readonly note?: string;
      readonly needsReview?: boolean;
    };

export interface Finding {
  readonly id: string;
  readonly claim: string;
  readonly references: readonly FindingReference[];
  readonly commentary?: string;
  readonly status: FindingStatus;
  readonly tags: readonly string[];
  readonly questionLinks: readonly FindingQuestionLink[];
  readonly hypothesisLinks: readonly FindingHypothesisLink[];
  readonly knowledgeSourceId?: string;
  readonly revision: number;
  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface CreateQuestionRequest {
  readonly text: string;
  readonly context?: string;
  readonly assumptions?: readonly string[];
  readonly tags?: readonly string[];
}

export interface UpdateQuestionRequest {
  readonly text?: string;
  readonly context?: string | null;
  readonly assumptions?: readonly string[];
  readonly tags?: readonly string[];
}

export interface QuestionFilter {
  readonly status?: QuestionStatus;
  readonly tag?: string;
}

export interface CreateHypothesisRequest {
  readonly questionIds?: readonly string[];
  readonly statement: string;
  readonly rationale?: string;
  readonly assumptions?: readonly string[];
  readonly confidenceLevel?: HypothesisConfidenceLevel;
}

export interface UpdateHypothesisRequest {
  readonly questionIds?: readonly string[];
  readonly statement?: string;
  readonly rationale?: string | null;
  readonly assumptions?: readonly string[];
  readonly status?: HypothesisStatus;
  readonly confidenceLevel?: HypothesisConfidenceLevel | null;
}

export interface HypothesisFilter {
  readonly questionId?: string;
  readonly status?: HypothesisStatus;
}

export interface ProposeFindingRequest {
  readonly claim: string;
  readonly references: readonly FindingReference[];
  readonly commentary?: string;
  readonly tags?: readonly string[];
  readonly questionLinks?: readonly FindingQuestionLink[];
  readonly hypothesisLinks?: readonly FindingHypothesisLink[];
}

export interface UpdateFindingRequest {
  readonly claim?: string;
  readonly references?: readonly FindingReference[];
  readonly commentary?: string | null;
  readonly tags?: readonly string[];
  readonly questionLinks?: readonly FindingQuestionLink[];
  readonly hypothesisLinks?: readonly FindingHypothesisLink[];
}

export interface FindingFilter {
  readonly status?: FindingStatus;
  readonly questionId?: string;
  readonly hypothesisId?: string;
}

/** Runtime attribution and deterministic seams used by tests. */
export interface InvestigationRuntimeContext {
  readonly actorId: ActorId;
  readonly now?: () => IsoTimestamp;
  readonly generateId?: () => string;
}

/** The one flat runtime used to manage all three Investigation record types. */
export interface InvestigationRuntime {
  createQuestion(request: CreateQuestionRequest): Promise<Question>;
  updateQuestion(id: string, request: UpdateQuestionRequest): Promise<Question>;
  proposeQuestionAnswer(id: string, currentAnswer: string): Promise<Question>;
  confirmQuestionAnswer(id: string): Promise<Question>;
  clearQuestionAnswer(id: string): Promise<Question>;
  getQuestion(id: string): Promise<Question | null>;
  listQuestions(filter?: QuestionFilter): Promise<Question[]>;
  deleteQuestion(id: string): Promise<void>;
  purgeQuestion(id: string): Promise<void>;

  createHypothesis(request: CreateHypothesisRequest): Promise<Hypothesis>;
  updateHypothesis(
    id: string,
    request: UpdateHypothesisRequest
  ): Promise<Hypothesis>;
  getHypothesis(id: string): Promise<Hypothesis | null>;
  listHypotheses(filter?: HypothesisFilter): Promise<Hypothesis[]>;
  deleteHypothesis(id: string): Promise<void>;
  purgeHypothesis(id: string): Promise<void>;

  proposeFinding(request: ProposeFindingRequest): Promise<Finding>;
  updateFinding(id: string, request: UpdateFindingRequest): Promise<Finding>;
  acceptFinding(id: string): Promise<Finding>;
  unacceptFinding(id: string): Promise<Finding>;
  rejectFinding(id: string): Promise<Finding>;
  markFindingReferenceForReview(
    id: string,
    referenceIndex: number
  ): Promise<Finding>;
  clearFindingReferenceReview(
    id: string,
    referenceIndex: number
  ): Promise<Finding>;
  getFinding(id: string): Promise<Finding | null>;
  listFindings(filter?: FindingFilter): Promise<Finding[]>;
  deleteFinding(id: string): Promise<void>;
  purgeFinding(id: string): Promise<void>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}

export const findingNeedsReview = (finding: Finding): boolean =>
  finding.references.some((reference) => reference.needsReview === true);

const isStringMember = <TValue extends string>(
  value: unknown,
  values: readonly TValue[]
): value is TValue => typeof value === "string" && values.includes(value as TValue);

export const isQuestionStatus = (value: unknown): value is QuestionStatus =>
  isStringMember(value, QUESTION_STATUSES);

export const isHypothesisStatus = (value: unknown): value is HypothesisStatus =>
  isStringMember(value, HYPOTHESIS_STATUSES);

export const isHypothesisConfidenceLevel = (
  value: unknown
): value is HypothesisConfidenceLevel =>
  isStringMember(value, HYPOTHESIS_CONFIDENCE_LEVELS);

export const isFindingStatus = (value: unknown): value is FindingStatus =>
  isStringMember(value, FINDING_STATUSES);

export const isFindingRelationship = (
  value: unknown
): value is FindingRelationship => isStringMember(value, FINDING_RELATIONSHIPS);

export type InvestigationEntity = "question" | "hypothesis" | "finding";

export type InvestigationErrorCode =
  | "not_found"
  | "invalid_input"
  | "invalid_operation";

/** Stable base error used by HTTP and other adapters without matching messages. */
export class InvestigationError extends Error {
  constructor(
    readonly code: InvestigationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "InvestigationError";
  }
}

export class InvestigationNotFoundError extends InvestigationError {
  constructor(
    readonly entity: InvestigationEntity,
    readonly id: string
  ) {
    super("not_found", `${entity} ${id} was not found`);
    this.name = "InvestigationNotFoundError";
  }
}

export class InvestigationInvalidInputError extends InvestigationError {
  constructor(message: string) {
    super("invalid_input", message);
    this.name = "InvestigationInvalidInputError";
  }
}

export class InvestigationInvalidOperationError extends InvestigationError {
  constructor(message: string) {
    super("invalid_operation", message);
    this.name = "InvestigationInvalidOperationError";
  }
}

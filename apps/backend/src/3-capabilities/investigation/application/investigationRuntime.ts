import { createHash, randomUUID } from "node:crypto";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { Logger } from "#platform/observability/logger.js";
import {
  InvestigationInvalidInputError,
  InvestigationInvalidOperationError,
  InvestigationNotFoundError,
  findingNeedsReview,
  isFindingRelationship,
  isFindingStatus,
  isHypothesisConfidenceLevel,
  isHypothesisStatus,
  isQuestionStatus,
  type CreateHypothesisRequest,
  type CreateQuestionRequest,
  type Finding,
  type FindingFilter,
  type FindingHypothesisLink,
  type FindingQuestionLink,
  type FindingReference,
  type FindingReferenceSpan,
  type Hypothesis,
  type HypothesisFilter,
  type InvestigationRuntime,
  type InvestigationRuntimeContext,
  type ProposeFindingRequest,
  type Question,
  type QuestionFilter,
  type UpdateFindingRequest,
  type UpdateHypothesisRequest,
  type UpdateQuestionRequest
} from "../domain/model.js";
import type { InvestigationStore } from "../ports/investigationStore.js";

type InvestigationKnowledge = Pick<Knowledge, "add" | "remove">;

const REVISIONED_RESOURCE_KINDS = new Set([
  "collection",
  "connector-item",
  "context",
  "deck",
  "derived-output",
  "document",
  "function",
  "general-file",
  "slide",
  "structured-data",
  "variable"
]);

const findingSourceId = (id: string): string => `finding:${id}`;

const claimRevision = (claim: string): string =>
  createHash("sha256").update(claim, "utf8").digest("hex");

const durationMs = (startedAt: number): number =>
  Math.round(performance.now() - startedAt);

const invalid = (message: string): never => {
  throw new InvestigationInvalidInputError(message);
};

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return invalid(`${label} must be a non-empty string`);
  }
  return value.trim();
};

const optionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return invalid(`${label} must be a string`);
  return value;
};

const stringList = (
  value: unknown,
  label: string,
  options: { trim?: boolean; deduplicate?: boolean; nonEmpty?: boolean } = {}
): string[] => {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const normalized = value.map((entry, index) => {
    if (typeof entry !== "string") {
      return invalid(`${label}[${index}] must be a string`);
    }
    const result = options.trim ? entry.trim() : entry;
    if (options.nonEmpty && result.length === 0) {
      return invalid(`${label}[${index}] must be non-empty`);
    }
    return result;
  });
  return options.deduplicate ? [...new Set(normalized)] : normalized;
};

const optionalTextField = (
  requestValue: unknown,
  currentValue: string | undefined,
  label: string
): string | undefined => {
  if (requestValue === undefined) return currentValue;
  if (requestValue === null) return undefined;
  return optionalString(requestValue, label);
};

const validateId = (value: unknown, label = "id"): string =>
  requiredString(value, label);

const validateTimestamp = (value: unknown, label: string): string => {
  const timestamp = requiredString(value, label);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) {
    return invalid(`${label} must be a valid timestamp`);
  }
  return parsed.toISOString();
};

const validateSpan = (
  value: unknown,
  label: string
): FindingReferenceSpan | undefined => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    return invalid(`${label} must be an object`);
  }
  const span = value as Record<string, unknown>;
  if (span.kind === "characters") {
    if (
      !Number.isSafeInteger(span.start) ||
      !Number.isSafeInteger(span.end) ||
      (span.start as number) < 0 ||
      (span.end as number) <= (span.start as number)
    ) {
      return invalid(`${label} character bounds are invalid`);
    }
    return {
      kind: "characters",
      start: span.start as number,
      end: span.end as number
    };
  }
  if (span.kind === "lines") {
    if (
      !Number.isSafeInteger(span.startLine) ||
      !Number.isSafeInteger(span.endLine) ||
      (span.startLine as number) < 1 ||
      (span.endLine as number) < (span.startLine as number)
    ) {
      return invalid(`${label} line bounds are invalid`);
    }
    return {
      kind: "lines",
      startLine: span.startLine as number,
      endLine: span.endLine as number
    };
  }
  return invalid(`${label}.kind is unsupported`);
};

const ownerExposesRevisions = (resourceKind: string): boolean =>
  REVISIONED_RESOURCE_KINDS.has(resourceKind) ||
  resourceKind.startsWith("connector::") ||
  resourceKind.startsWith("general::file::");

const validateRevision = (
  value: unknown,
  label: string
): number | string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 1) {
      return invalid(`${label} must be a positive integer or non-empty string`);
    }
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return invalid(`${label} must be a positive integer or non-empty string`);
};

const validateReference = (
  value: unknown,
  index: number
): FindingReference => {
  const label = `references[${index}]`;
  if (!value || typeof value !== "object") {
    return invalid(`${label} must be an object`);
  }
  const reference = value as Record<string, unknown>;
  const span = validateSpan(reference.span, `${label}.span`);
  const note = optionalString(reference.note, `${label}.note`);
  if (
    reference.needsReview !== undefined &&
    typeof reference.needsReview !== "boolean"
  ) {
    return invalid(`${label}.needsReview must be a boolean`);
  }
  const shared = {
    ...(span ? { span } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(reference.needsReview === true ? { needsReview: true } : {})
  };

  if (reference.kind === "resource") {
    const resourceKind = requiredString(
      reference.resourceKind,
      `${label}.resourceKind`
    );
    const resourceId = requiredString(reference.resourceId, `${label}.resourceId`);
    const locator = optionalString(reference.locator, `${label}.locator`);
    const resourceRevision = validateRevision(
      reference.resourceRevision,
      `${label}.resourceRevision`
    );
    if (ownerExposesRevisions(resourceKind) && resourceRevision === undefined) {
      return invalid(
        `${label}.resourceRevision is required for resource kind ${resourceKind}`
      );
    }
    return {
      kind: "resource",
      resourceKind,
      resourceId,
      ...(locator !== undefined ? { locator } : {}),
      ...(resourceRevision !== undefined ? { resourceRevision } : {}),
      ...shared
    };
  }

  if (reference.kind === "url") {
    const href = requiredString(reference.href, `${label}.href`);
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return invalid(`${label}.href must be a valid HTTP(S) URL`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return invalid(`${label}.href must be a valid HTTP(S) URL`);
    }
    return {
      kind: "url",
      href,
      observedAt: validateTimestamp(reference.observedAt, `${label}.observedAt`),
      ...shared
    };
  }

  return invalid(`${label}.kind is unsupported`);
};

const validateReferences = (value: unknown): FindingReference[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid("references must contain at least one reference");
  }
  return value.map(validateReference);
};

const validateQuestionLinks = (value: unknown): FindingQuestionLink[] => {
  if (!Array.isArray(value)) return invalid("questionLinks must be an array");
  const links = new Map<string, FindingQuestionLink>();
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      invalid(`questionLinks[${index}] must be an object`);
    }
    const raw = entry as Record<string, unknown>;
    const questionId = validateId(raw.questionId, `questionLinks[${index}].questionId`);
    if (
      raw.relationship !== undefined &&
      !isFindingRelationship(raw.relationship)
    ) {
      invalid(`questionLinks[${index}].relationship is unsupported`);
    }
    links.set(questionId, {
      questionId,
      ...(raw.relationship !== undefined
        ? { relationship: raw.relationship as FindingQuestionLink["relationship"] }
        : {})
    });
  });
  return [...links.values()];
};

const validateHypothesisLinks = (value: unknown): FindingHypothesisLink[] => {
  if (!Array.isArray(value)) return invalid("hypothesisLinks must be an array");
  const links = new Map<string, FindingHypothesisLink>();
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      invalid(`hypothesisLinks[${index}] must be an object`);
    }
    const raw = entry as Record<string, unknown>;
    const hypothesisId = validateId(
      raw.hypothesisId,
      `hypothesisLinks[${index}].hypothesisId`
    );
    if (
      raw.relationship !== undefined &&
      !isFindingRelationship(raw.relationship)
    ) {
      invalid(`hypothesisLinks[${index}].relationship is unsupported`);
    }
    links.set(hypothesisId, {
      hypothesisId,
      ...(raw.relationship !== undefined
        ? { relationship: raw.relationship as FindingHypothesisLink["relationship"] }
        : {})
    });
  });
  return [...links.values()];
};

const validateReferenceIndex = (value: unknown, length: number): number => {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) >= length
  ) {
    return invalid("referenceIndex is out of range");
  }
  return value as number;
};

const questionOrThrow = (store: InvestigationStore, id: string): Question => {
  const question = store.getQuestion(validateId(id));
  if (!question) throw new InvestigationNotFoundError("question", id);
  return question;
};

const hypothesisOrThrow = (
  store: InvestigationStore,
  id: string
): Hypothesis => {
  const hypothesis = store.getHypothesis(validateId(id));
  if (!hypothesis) throw new InvestigationNotFoundError("hypothesis", id);
  return hypothesis;
};

const findingOrThrow = (store: InvestigationStore, id: string): Finding => {
  const finding = store.getFinding(validateId(id));
  if (!finding) throw new InvestigationNotFoundError("finding", id);
  return finding;
};

/**
 * Build the single service-layer object for Questions, Hypotheses, and
 * Findings. HTTP queue policy serializes authored mutations; the runtime also
 * makes Finding acceptance safe when invoked concurrently in-process.
 */
export function createInvestigationRuntime(
  store: InvestigationStore,
  knowledge: InvestigationKnowledge,
  logger: Logger,
  context: InvestigationRuntimeContext
): InvestigationRuntime {
  const actorId = requiredString(context.actorId, "actorId");
  const now = context.now ?? (() => new Date().toISOString());
  const generateId = context.generateId ?? randomUUID;

  const timestamp = (): string => validateTimestamp(now(), "runtime timestamp");
  const newId = (): string => validateId(generateId(), "generated id");

  const addFindingToKnowledge = async (finding: Finding): Promise<void> => {
    const result = await knowledge.add({
      sourceId: findingSourceId(finding.id),
      label: "finding",
      revision: claimRevision(finding.claim),
      text: finding.claim
    });
    logger.debug("investigation.findings.knowledge.add", {
      findingId: finding.id,
      skipped: result.skipped,
      windowsAdded: result.windowsAdded,
      windowsReused: result.windowsReused
    });
  };

  /** Reconcile the one stable source against whichever database write won. */
  const reconcileFindingKnowledge = async (
    id: string
  ): Promise<Finding | undefined> => {
    const sourceId = findingSourceId(id);
    for (;;) {
      const current = store.getFinding(id);
      if (!current) {
        await knowledge.remove(sourceId);
        if (!store.getFinding(id)) return undefined;
        continue;
      }

      if (current.status === "accepted") {
        if (current.knowledgeSourceId !== sourceId) {
          store.acceptFindingIfClaimMatches(
            current.id,
            current.claim,
            sourceId,
            actorId,
            timestamp()
          );
          continue;
        }
        await addFindingToKnowledge(current);
        const after = store.getFinding(id);
        if (
          after?.status === "accepted" &&
          after.claim === current.claim &&
          after.knowledgeSourceId === sourceId
        ) {
          return after;
        }
        continue;
      }

      await knowledge.remove(sourceId);
      const after = store.getFinding(id);
      if (
        after &&
        after.status !== "accepted" &&
        after.claim === current.claim
      ) {
        return after;
      }
    }
  };

  const runtime: InvestigationRuntime = {
    async createQuestion(request: CreateQuestionRequest): Promise<Question> {
      const startedAt = performance.now();
      if (!request || typeof request !== "object") {
        return invalid("question request must be an object");
      }
      const createdAt = timestamp();
      const question: Question = {
        id: newId(),
        text: requiredString(request.text, "text"),
        ...(request.context !== undefined
          ? { context: optionalString(request.context, "context")! }
          : {}),
        assumptions: stringList(request.assumptions ?? [], "assumptions"),
        status: "open",
        tags: stringList(request.tags ?? [], "tags", {
          trim: true,
          deduplicate: true,
          nonEmpty: true
        }),
        revision: 1,
        createdBy: actorId,
        updatedBy: actorId,
        createdAt,
        updatedAt: createdAt
      };
      store.insertQuestion(question);
      logger.info("investigation.questions.created", {
        questionId: question.id,
        actorId,
        status: question.status,
        assumptionCount: question.assumptions.length,
        tagCount: question.tags.length,
        durationMs: durationMs(startedAt)
      });
      return question;
    },

    async updateQuestion(
      id: string,
      request: UpdateQuestionRequest
    ): Promise<Question> {
      const startedAt = performance.now();
      if (!request || typeof request !== "object") {
        return invalid("question update must be an object");
      }
      const current = questionOrThrow(store, id);
      const contextValue = optionalTextField(
        request.context,
        current.context,
        "context"
      );
      const question: Question = {
        ...current,
        revision: current.revision + 1,
        text:
          request.text === undefined
            ? current.text
            : requiredString(request.text, "text"),
        ...(contextValue !== undefined ? { context: contextValue } : {}),
        assumptions:
          request.assumptions === undefined
            ? current.assumptions
            : stringList(request.assumptions, "assumptions"),
        tags:
          request.tags === undefined
            ? current.tags
            : stringList(request.tags, "tags", {
                trim: true,
                deduplicate: true,
                nonEmpty: true
              }),
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      if (contextValue === undefined) delete (question as { context?: string }).context;
      store.updateQuestion(question);
      logger.info("investigation.questions.updated", {
        questionId: question.id,
        actorId,
        priorStatus: current.status,
        status: question.status,
        assumptionCount: question.assumptions.length,
        tagCount: question.tags.length,
        durationMs: durationMs(startedAt)
      });
      return question;
    },

    async proposeQuestionAnswer(id: string, currentAnswer: string): Promise<Question> {
      const startedAt = performance.now();
      const current = questionOrThrow(store, id);
      const question: Question = {
        ...current,
        revision: current.revision + 1,
        currentAnswer: requiredString(currentAnswer, "currentAnswer"),
        status: "proposed",
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      store.updateQuestion(question);
      logger.info("investigation.questions.answer.proposed", {
        questionId: question.id,
        actorId,
        priorStatus: current.status,
        status: question.status,
        durationMs: durationMs(startedAt)
      });
      return question;
    },

    async confirmQuestionAnswer(id: string): Promise<Question> {
      const startedAt = performance.now();
      const current = questionOrThrow(store, id);
      if (!current.currentAnswer || current.currentAnswer.trim().length === 0) {
        throw new InvestigationInvalidOperationError(
          "a question must have a current answer before it can be confirmed"
        );
      }
      if (current.status === "answered") return current;
      const question: Question = {
        ...current,
        revision: current.revision + 1,
        status: "answered",
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      store.updateQuestion(question);
      logger.info("investigation.questions.answer.confirmed", {
        questionId: question.id,
        actorId,
        priorStatus: current.status,
        status: question.status,
        durationMs: durationMs(startedAt)
      });
      return question;
    },

    async clearQuestionAnswer(id: string): Promise<Question> {
      const startedAt = performance.now();
      const current = questionOrThrow(store, id);
      const question: Question = {
        ...current,
        revision: current.revision + 1,
        status: "open",
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      delete (question as { currentAnswer?: string }).currentAnswer;
      store.updateQuestion(question);
      logger.info("investigation.questions.answer.cleared", {
        questionId: question.id,
        actorId,
        priorStatus: current.status,
        status: question.status,
        durationMs: durationMs(startedAt)
      });
      return question;
    },

    async getQuestion(id: string): Promise<Question | null> {
      const canonicalId = validateId(id);
      const question = store.getQuestion(canonicalId) ?? null;
      logger.debug("investigation.questions.read", {
        questionId: canonicalId,
        found: question !== null
      });
      return question;
    },

    async listQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
      if (filter.status !== undefined && !isQuestionStatus(filter.status)) {
        return invalid("question status is unsupported");
      }
      const canonicalFilter: QuestionFilter = {
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.tag !== undefined
          ? { tag: requiredString(filter.tag, "tag") }
          : {})
      };
      const questions = store.listQuestions(canonicalFilter);
      logger.debug("investigation.questions.listed", {
        status: canonicalFilter.status,
        hasTagFilter: canonicalFilter.tag !== undefined,
        count: questions.length
      });
      return questions;
    },

    async deleteQuestion(id: string): Promise<void> {
      const startedAt = performance.now();
      const question = questionOrThrow(store, id);
      const deletedAt = timestamp();
      store.deleteQuestion(question, deletedAt);
      logger.info("investigation.questions.deleted", {
        questionId: question.id,
        actorId,
        priorStatus: question.status,
        durationMs: durationMs(startedAt)
      });
    },

    async purgeQuestion(id: string): Promise<void> {
      store.purge("question", validateId(id));
    },

    async createHypothesis(
      request: CreateHypothesisRequest
    ): Promise<Hypothesis> {
      const startedAt = performance.now();
      if (!request || typeof request !== "object") {
        return invalid("hypothesis request must be an object");
      }
      if (
        request.confidenceLevel !== undefined &&
        !isHypothesisConfidenceLevel(request.confidenceLevel)
      ) {
        return invalid("confidenceLevel is unsupported");
      }
      const createdAt = timestamp();
      const rationale = optionalString(request.rationale, "rationale");
      const hypothesis: Hypothesis = {
        id: newId(),
        questionIds: stringList(request.questionIds ?? [], "questionIds", {
          trim: true,
          deduplicate: true,
          nonEmpty: true
        }),
        statement: requiredString(request.statement, "statement"),
        ...(rationale !== undefined ? { rationale } : {}),
        assumptions: stringList(request.assumptions ?? [], "assumptions"),
        status: "proposed",
        ...(request.confidenceLevel !== undefined
          ? { confidenceLevel: request.confidenceLevel }
          : {}),
        revision: 1,
        createdBy: actorId,
        updatedBy: actorId,
        createdAt,
        updatedAt: createdAt
      };
      store.insertHypothesis(hypothesis);
      logger.info("investigation.hypotheses.created", {
        hypothesisId: hypothesis.id,
        actorId,
        status: hypothesis.status,
        confidenceLevel: hypothesis.confidenceLevel,
        questionCount: hypothesis.questionIds.length,
        assumptionCount: hypothesis.assumptions.length,
        durationMs: durationMs(startedAt)
      });
      return hypothesis;
    },

    async updateHypothesis(
      id: string,
      request: UpdateHypothesisRequest
    ): Promise<Hypothesis> {
      const startedAt = performance.now();
      if (!request || typeof request !== "object") {
        return invalid("hypothesis update must be an object");
      }
      const current = hypothesisOrThrow(store, id);
      if (request.status !== undefined && !isHypothesisStatus(request.status)) {
        return invalid("hypothesis status is unsupported");
      }
      if (
        request.confidenceLevel !== undefined &&
        request.confidenceLevel !== null &&
        !isHypothesisConfidenceLevel(request.confidenceLevel)
      ) {
        return invalid("confidenceLevel is unsupported");
      }
      const rationale = optionalTextField(
        request.rationale,
        current.rationale,
        "rationale"
      );
      const confidenceLevel =
        request.confidenceLevel === undefined
          ? current.confidenceLevel
          : request.confidenceLevel === null
            ? undefined
            : request.confidenceLevel;
      const hypothesis: Hypothesis = {
        ...current,
        revision: current.revision + 1,
        questionIds:
          request.questionIds === undefined
            ? current.questionIds
            : stringList(request.questionIds, "questionIds", {
                trim: true,
                deduplicate: true,
                nonEmpty: true
              }),
        statement:
          request.statement === undefined
            ? current.statement
            : requiredString(request.statement, "statement"),
        ...(rationale !== undefined ? { rationale } : {}),
        assumptions:
          request.assumptions === undefined
            ? current.assumptions
            : stringList(request.assumptions, "assumptions"),
        status: request.status ?? current.status,
        ...(confidenceLevel !== undefined ? { confidenceLevel } : {}),
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      if (rationale === undefined) delete (hypothesis as { rationale?: string }).rationale;
      if (confidenceLevel === undefined) {
        delete (hypothesis as { confidenceLevel?: Hypothesis["confidenceLevel"] })
          .confidenceLevel;
      }
      store.updateHypothesis(hypothesis);
      logger.info("investigation.hypotheses.updated", {
        hypothesisId: hypothesis.id,
        actorId,
        priorStatus: current.status,
        status: hypothesis.status,
        confidenceLevel: hypothesis.confidenceLevel,
        questionCount: hypothesis.questionIds.length,
        assumptionCount: hypothesis.assumptions.length,
        durationMs: durationMs(startedAt)
      });
      return hypothesis;
    },

    async getHypothesis(id: string): Promise<Hypothesis | null> {
      const canonicalId = validateId(id);
      const hypothesis = store.getHypothesis(canonicalId) ?? null;
      logger.debug("investigation.hypotheses.read", {
        hypothesisId: canonicalId,
        found: hypothesis !== null
      });
      return hypothesis;
    },

    async listHypotheses(filter: HypothesisFilter = {}): Promise<Hypothesis[]> {
      if (filter.status !== undefined && !isHypothesisStatus(filter.status)) {
        return invalid("hypothesis status is unsupported");
      }
      const canonicalFilter: HypothesisFilter = {
        ...(filter.questionId !== undefined
          ? { questionId: validateId(filter.questionId, "questionId") }
          : {}),
        ...(filter.status !== undefined ? { status: filter.status } : {})
      };
      const hypotheses = store.listHypotheses(canonicalFilter);
      logger.debug("investigation.hypotheses.listed", {
        status: canonicalFilter.status,
        hasQuestionFilter: canonicalFilter.questionId !== undefined,
        count: hypotheses.length
      });
      return hypotheses;
    },

    async deleteHypothesis(id: string): Promise<void> {
      const startedAt = performance.now();
      const hypothesis = hypothesisOrThrow(store, id);
      const deletedAt = timestamp();
      store.deleteHypothesis(hypothesis, deletedAt);
      logger.info("investigation.hypotheses.deleted", {
        hypothesisId: hypothesis.id,
        actorId,
        priorStatus: hypothesis.status,
        durationMs: durationMs(startedAt)
      });
    },

    async purgeHypothesis(id: string): Promise<void> {
      store.purge("hypothesis", validateId(id));
    },

    async proposeFinding(request: ProposeFindingRequest): Promise<Finding> {
      const startedAt = performance.now();
      if (!request || typeof request !== "object") {
        return invalid("finding request must be an object");
      }
      const commentary = optionalString(request.commentary, "commentary");
      const createdAt = timestamp();
      const finding: Finding = {
        id: newId(),
        claim: requiredString(request.claim, "claim"),
        references: validateReferences(request.references),
        ...(commentary !== undefined ? { commentary } : {}),
        status: "proposed",
        tags: stringList(request.tags ?? [], "tags", {
          trim: true,
          deduplicate: true,
          nonEmpty: true
        }),
        questionLinks: validateQuestionLinks(request.questionLinks ?? []),
        hypothesisLinks: validateHypothesisLinks(request.hypothesisLinks ?? []),
        revision: 1,
        createdBy: actorId,
        updatedBy: actorId,
        createdAt,
        updatedAt: createdAt
      };
      store.insertFinding(finding);
      logger.info("investigation.findings.proposed", {
        findingId: finding.id,
        actorId,
        status: finding.status,
        referenceCount: finding.references.length,
        questionLinkCount: finding.questionLinks.length,
        hypothesisLinkCount: finding.hypothesisLinks.length,
        needsReview: findingNeedsReview(finding),
        durationMs: durationMs(startedAt)
      });
      return finding;
    },

    async updateFinding(
      id: string,
      request: UpdateFindingRequest
    ): Promise<Finding> {
      const startedAt = performance.now();
      if (!request || typeof request !== "object") {
        return invalid("finding update must be an object");
      }
      const current = findingOrThrow(store, id);
      const commentary = optionalTextField(
        request.commentary,
        current.commentary,
        "commentary"
      );
      const finding: Finding = {
        ...current,
        revision: current.revision + 1,
        claim:
          request.claim === undefined
            ? current.claim
            : requiredString(request.claim, "claim"),
        references:
          request.references === undefined
            ? current.references
            : validateReferences(request.references),
        ...(commentary !== undefined ? { commentary } : {}),
        tags:
          request.tags === undefined
            ? current.tags
            : stringList(request.tags, "tags", {
                trim: true,
                deduplicate: true,
                nonEmpty: true
              }),
        questionLinks:
          request.questionLinks === undefined
            ? current.questionLinks
            : validateQuestionLinks(request.questionLinks),
        hypothesisLinks:
          request.hypothesisLinks === undefined
            ? current.hypothesisLinks
            : validateHypothesisLinks(request.hypothesisLinks),
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      if (commentary === undefined) {
        delete (finding as { commentary?: string }).commentary;
      }

      const claimChanged = finding.claim !== current.claim;
      if (current.status === "accepted" && claimChanged) {
        await addFindingToKnowledge(finding);
      }
      try {
        store.updateFinding(finding);
      } catch (error) {
        if (current.status === "accepted" && claimChanged) {
          await addFindingToKnowledge(current);
        }
        throw error;
      }
      // Accepted metadata-only edits keep the same source and revision, so
      // they do not call Knowledge. Claim changes and non-accepted edits still
      // reconcile because they may overlap the concurrent accept operation.
      const reconciled =
        current.status === "accepted" && !claimChanged
          ? store.getFinding(finding.id)
          : await reconcileFindingKnowledge(finding.id);
      if (!reconciled) throw new InvestigationNotFoundError("finding", finding.id);
      logger.info("investigation.findings.updated", {
        findingId: reconciled.id,
        actorId,
        priorStatus: current.status,
        status: reconciled.status,
        claimChanged,
        knowledgeRefreshed: claimChanged && reconciled.status === "accepted",
        referenceCount: reconciled.references.length,
        questionLinkCount: reconciled.questionLinks.length,
        hypothesisLinkCount: reconciled.hypothesisLinks.length,
        needsReview: findingNeedsReview(reconciled),
        durationMs: durationMs(startedAt)
      });
      return reconciled;
    },

    async acceptFinding(id: string): Promise<Finding> {
      const startedAt = performance.now();
      const canonicalId = validateId(id);
      let attempts = 0;
      for (;;) {
        attempts += 1;
        const current = store.getFinding(canonicalId);
        if (!current) {
          if (attempts > 1) {
            try {
              await knowledge.remove(findingSourceId(canonicalId));
            } catch (error) {
              logger.error("investigation.findings.knowledge.cleanup.failed", {
                findingId: canonicalId,
                errorName: error instanceof Error ? error.name : "UnknownError",
                errorMessage: error instanceof Error ? error.message : String(error)
              });
            }
          }
          throw new InvestigationNotFoundError("finding", canonicalId);
        }

        await addFindingToKnowledge(current);
        const sourceId = findingSourceId(current.id);

        if (
          current.status === "accepted" &&
          current.knowledgeSourceId === sourceId
        ) {
          const unchanged = store.getFinding(current.id);
          if (
            unchanged?.status === "accepted" &&
            unchanged.claim === current.claim &&
            unchanged.knowledgeSourceId === sourceId
          ) {
            logger.info("investigation.findings.accepted", {
              findingId: unchanged.id,
              actorId,
              priorStatus: current.status,
              status: unchanged.status,
              attempts,
              idempotent: true,
              durationMs: durationMs(startedAt)
            });
            return unchanged;
          }
          continue;
        }

        // A serial edit may win while Knowledge is ingesting. Claim comparison
        // makes acceptance retry the new claim without a public revision/CAS type.
        const committed = store.acceptFindingIfClaimMatches(
          current.id,
          current.claim,
          sourceId,
          actorId,
          timestamp()
        );
        if (!committed) continue;

        const reconciled = await reconcileFindingKnowledge(current.id);
        if (!reconciled) {
          throw new InvestigationNotFoundError("finding", current.id);
        }
        if (
          reconciled.status !== "accepted" ||
          reconciled.claim !== current.claim ||
          reconciled.knowledgeSourceId !== sourceId
        ) {
          continue;
        }
        logger.info("investigation.findings.accepted", {
          findingId: reconciled.id,
          actorId,
          priorStatus: current.status,
          status: reconciled.status,
          attempts,
          durationMs: durationMs(startedAt)
        });
        return reconciled;
      }
    },

    async unacceptFinding(id: string): Promise<Finding> {
      const startedAt = performance.now();
      const current = findingOrThrow(store, id);
      if (current.status === "rejected") {
        throw new InvestigationInvalidOperationError(
          "a rejected finding cannot be unaccepted"
        );
      }
      if (current.status === "accepted") {
        const finding: Finding = {
          ...current,
          revision: current.revision + 1,
          status: "proposed",
          updatedBy: actorId,
          updatedAt: timestamp()
        };
        delete (finding as { knowledgeSourceId?: string }).knowledgeSourceId;
        await knowledge.remove(current.knowledgeSourceId ?? findingSourceId(current.id));
        try {
          store.updateFinding(finding);
        } catch (error) {
          await addFindingToKnowledge(current);
          throw error;
        }
      }
      const reconciled = await reconcileFindingKnowledge(current.id);
      if (!reconciled) throw new InvestigationNotFoundError("finding", current.id);
      logger.info("investigation.findings.unaccepted", {
        findingId: reconciled.id,
        actorId,
        priorStatus: current.status,
        status: reconciled.status,
        durationMs: durationMs(startedAt)
      });
      return reconciled;
    },

    async rejectFinding(id: string): Promise<Finding> {
      const startedAt = performance.now();
      const current = findingOrThrow(store, id);
      if (current.status === "accepted") {
        await knowledge.remove(current.knowledgeSourceId ?? findingSourceId(current.id));
      }
      const finding: Finding = {
        ...current,
        revision: current.revision + 1,
        status: "rejected",
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      delete (finding as { knowledgeSourceId?: string }).knowledgeSourceId;
      try {
        store.updateFinding(finding);
      } catch (error) {
        if (current.status === "accepted") await addFindingToKnowledge(current);
        throw error;
      }
      const reconciled = await reconcileFindingKnowledge(finding.id);
      if (!reconciled) throw new InvestigationNotFoundError("finding", finding.id);
      logger.info("investigation.findings.rejected", {
        findingId: reconciled.id,
        actorId,
        priorStatus: current.status,
        status: reconciled.status,
        durationMs: durationMs(startedAt)
      });
      return reconciled;
    },

    async markFindingReferenceForReview(
      id: string,
      referenceIndex: number
    ): Promise<Finding> {
      const startedAt = performance.now();
      const current = findingOrThrow(store, id);
      const index = validateReferenceIndex(referenceIndex, current.references.length);
      const references = current.references.map((reference, candidate) =>
        candidate === index ? { ...reference, needsReview: true as const } : reference
      );
      const finding: Finding = {
        ...current,
        revision: current.revision + 1,
        references,
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      store.updateFinding(finding);
      const reconciled =
        current.status === "accepted"
          ? store.getFinding(finding.id)
          : await reconcileFindingKnowledge(finding.id);
      if (!reconciled) throw new InvestigationNotFoundError("finding", finding.id);
      logger.info("investigation.findings.reference.review-marked", {
        findingId: reconciled.id,
        actorId,
        referenceIndex: index,
        needsReview: findingNeedsReview(reconciled),
        durationMs: durationMs(startedAt)
      });
      return reconciled;
    },

    async clearFindingReferenceReview(
      id: string,
      referenceIndex: number
    ): Promise<Finding> {
      const startedAt = performance.now();
      const current = findingOrThrow(store, id);
      const index = validateReferenceIndex(referenceIndex, current.references.length);
      const references = current.references.map((reference, candidate) => {
        if (candidate !== index) return reference;
        const { needsReview: _needsReview, ...cleared } = reference;
        return cleared;
      });
      const finding: Finding = {
        ...current,
        revision: current.revision + 1,
        references,
        updatedBy: actorId,
        updatedAt: timestamp()
      };
      store.updateFinding(finding);
      const reconciled =
        current.status === "accepted"
          ? store.getFinding(finding.id)
          : await reconcileFindingKnowledge(finding.id);
      if (!reconciled) throw new InvestigationNotFoundError("finding", finding.id);
      logger.info("investigation.findings.reference.review-cleared", {
        findingId: reconciled.id,
        actorId,
        referenceIndex: index,
        needsReview: findingNeedsReview(reconciled),
        durationMs: durationMs(startedAt)
      });
      return reconciled;
    },

    async getFinding(id: string): Promise<Finding | null> {
      const canonicalId = validateId(id);
      const finding = store.getFinding(canonicalId) ?? null;
      logger.debug("investigation.findings.read", {
        findingId: canonicalId,
        found: finding !== null
      });
      return finding;
    },

    async listFindings(filter: FindingFilter = {}): Promise<Finding[]> {
      if (filter.status !== undefined && !isFindingStatus(filter.status)) {
        return invalid("finding status is unsupported");
      }
      const canonicalFilter: FindingFilter = {
        ...(filter.status !== undefined ? { status: filter.status } : {}),
        ...(filter.questionId !== undefined
          ? { questionId: validateId(filter.questionId, "questionId") }
          : {}),
        ...(filter.hypothesisId !== undefined
          ? { hypothesisId: validateId(filter.hypothesisId, "hypothesisId") }
          : {})
      };
      const findings = store.listFindings(canonicalFilter);
      logger.debug("investigation.findings.listed", {
        status: canonicalFilter.status,
        hasQuestionFilter: canonicalFilter.questionId !== undefined,
        hasHypothesisFilter: canonicalFilter.hypothesisId !== undefined,
        count: findings.length
      });
      return findings;
    },

    async deleteFinding(id: string): Promise<void> {
      const startedAt = performance.now();
      const current = findingOrThrow(store, id);
      if (current.status === "accepted") {
        await knowledge.remove(current.knowledgeSourceId ?? findingSourceId(current.id));
      }
      const deletedAt = timestamp();
      try {
        store.deleteFinding(current, deletedAt);
      } catch (error) {
        if (current.status === "accepted") await addFindingToKnowledge(current);
        throw error;
      }
      await reconcileFindingKnowledge(current.id);
      logger.info("investigation.findings.deleted", {
        findingId: current.id,
        actorId,
        priorStatus: current.status,
        durationMs: durationMs(startedAt)
      });
    },

    async purgeFinding(id: string): Promise<void> {
      store.purge("finding", validateId(id));
    },

    async pruneHistory(cutoff: string): Promise<number> {
      return store.pruneHistory(cutoff);
    },

    async purgeExpired(cutoff: string): Promise<number> {
      const expired = store.expiredDeleted(cutoff);
      for (const resource of expired) {
        store.purge(resource.resourceKind, resource.resourceId);
      }
      return expired.length;
    }
  };

  logger.info("investigation.runtime.created", { actorId });
  return runtime;
}

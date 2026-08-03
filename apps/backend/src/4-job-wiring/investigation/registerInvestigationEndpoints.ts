import {
  InvestigationError,
  type InvestigationRuntime
} from "#investigation";
import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";

type CreateQuestionRequest = Parameters<InvestigationRuntime["createQuestion"]>[0];
type UpdateQuestionRequest = Parameters<InvestigationRuntime["updateQuestion"]>[1];
type CreateHypothesisRequest = Parameters<InvestigationRuntime["createHypothesis"]>[0];
type UpdateHypothesisRequest = Parameters<InvestigationRuntime["updateHypothesis"]>[1];
type ProposeFindingRequest = Parameters<InvestigationRuntime["proposeFinding"]>[0];
type UpdateFindingRequest = Parameters<InvestigationRuntime["updateFinding"]>[1];
type FindingReference = ProposeFindingRequest["references"][number];
type FindingQuestionLink = NonNullable<ProposeFindingRequest["questionLinks"]>[number];
type FindingHypothesisLink = NonNullable<ProposeFindingRequest["hypothesisLinks"]>[number];

type EndpointResponse = { statusCode: number; body: unknown };

const QUESTION_STATUSES = ["open", "proposed", "answered"] as const;
const HYPOTHESIS_STATUSES = [
  "proposed",
  "accepted",
  "refuted",
  "inconclusive"
] as const;
const CONFIDENCE_LEVELS = [
  "strongly_refuted",
  "weakly_refuted",
  "uncertain",
  "weakly_supported",
  "strongly_supported"
] as const;
const FINDING_STATUSES = ["proposed", "accepted", "rejected"] as const;
const FINDING_RELATIONSHIPS = [
  "supports",
  "refutes",
  "qualifies",
  "contextualizes"
] as const;

class InvestigationIngressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvestigationIngressError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new InvestigationIngressError(`${label} must be an object`);
  }
  return value;
};

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvestigationIngressError(`${label} must be a non-empty string`);
  }
  return value;
};

const optionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new InvestigationIngressError(`${label} must be a string`);
  }
  return value;
};

const nullableString = (
  value: unknown,
  label: string
): string | null | undefined => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") {
    throw new InvestigationIngressError(`${label} must be a string or null`);
  }
  return value;
};

const optionalStrings = (
  value: unknown,
  label: string
): readonly string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new InvestigationIngressError(`${label} must be an array of strings`);
  }
  return value as string[];
};

const optionalBoolean = (value: unknown, label: string): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new InvestigationIngressError(`${label} must be a boolean`);
  }
  return value;
};

const safeInteger = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value)) {
    throw new InvestigationIngressError(`${label} must be an integer`);
  }
  return value as number;
};

const oneOf = <const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] => {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new InvestigationIngressError(
      `${label} must be one of: ${allowed.join(", ")}`
    );
  }
  return value as T[number];
};

const optionalOneOf = <const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] | undefined =>
  value === undefined ? undefined : oneOf(value, allowed, label);

const nullableOneOf = <const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] | null | undefined =>
  value === undefined || value === null ? value : oneOf(value, allowed, label);

const decodeQuestionCreate = (value: unknown): CreateQuestionRequest => {
  const body = record(value, "Question create body");
  return {
    text: requiredString(body.text, "Question text"),
    ...(body.context !== undefined
      ? { context: optionalString(body.context, "Question context") }
      : {}),
    ...(body.assumptions !== undefined
      ? { assumptions: optionalStrings(body.assumptions, "Question assumptions") }
      : {}),
    ...(body.tags !== undefined
      ? { tags: optionalStrings(body.tags, "Question tags") }
      : {})
  };
};

const decodeQuestionUpdate = (body: Record<string, unknown>): UpdateQuestionRequest => ({
  ...(body.text !== undefined
    ? { text: requiredString(body.text, "Question text") }
    : {}),
  ...(body.context !== undefined
    ? { context: nullableString(body.context, "Question context") }
    : {}),
  ...(body.assumptions !== undefined
    ? { assumptions: optionalStrings(body.assumptions, "Question assumptions") }
    : {}),
  ...(body.tags !== undefined
    ? { tags: optionalStrings(body.tags, "Question tags") }
    : {})
});

const decodeHypothesisCreate = (value: unknown): CreateHypothesisRequest => {
  const body = record(value, "Hypothesis create body");
  return {
    statement: requiredString(body.statement, "Hypothesis statement"),
    ...(body.questionIds !== undefined
      ? { questionIds: optionalStrings(body.questionIds, "Hypothesis questionIds") }
      : {}),
    ...(body.rationale !== undefined
      ? { rationale: optionalString(body.rationale, "Hypothesis rationale") }
      : {}),
    ...(body.assumptions !== undefined
      ? { assumptions: optionalStrings(body.assumptions, "Hypothesis assumptions") }
      : {}),
    ...(body.confidenceLevel !== undefined
      ? {
          confidenceLevel: optionalOneOf(
            body.confidenceLevel,
            CONFIDENCE_LEVELS,
            "Hypothesis confidenceLevel"
          )
        }
      : {})
  };
};

const decodeHypothesisUpdate = (
  body: Record<string, unknown>
): UpdateHypothesisRequest => ({
  ...(body.questionIds !== undefined
    ? { questionIds: optionalStrings(body.questionIds, "Hypothesis questionIds") }
    : {}),
  ...(body.statement !== undefined
    ? { statement: requiredString(body.statement, "Hypothesis statement") }
    : {}),
  ...(body.rationale !== undefined
    ? { rationale: nullableString(body.rationale, "Hypothesis rationale") }
    : {}),
  ...(body.assumptions !== undefined
    ? { assumptions: optionalStrings(body.assumptions, "Hypothesis assumptions") }
    : {}),
  ...(body.status !== undefined
    ? {
        status: optionalOneOf(
          body.status,
          HYPOTHESIS_STATUSES,
          "Hypothesis status"
        )
      }
    : {}),
  ...(body.confidenceLevel !== undefined
    ? {
        confidenceLevel: nullableOneOf(
          body.confidenceLevel,
          CONFIDENCE_LEVELS,
          "Hypothesis confidenceLevel"
        )
      }
    : {})
});

const decodeSpan = (value: unknown): FindingReference["span"] => {
  if (value === undefined) return undefined;
  const span = record(value, "Finding reference span");
  if (span.kind === "characters") {
    return {
      kind: "characters",
      start: safeInteger(span.start, "Finding character span start"),
      end: safeInteger(span.end, "Finding character span end")
    };
  }
  if (span.kind === "lines") {
    return {
      kind: "lines",
      startLine: safeInteger(span.startLine, "Finding line span startLine"),
      endLine: safeInteger(span.endLine, "Finding line span endLine")
    };
  }
  throw new InvestigationIngressError(
    "Finding reference span kind must be characters or lines"
  );
};

const decodeReference = (value: unknown): FindingReference => {
  const reference = record(value, "Finding reference");
  const span = decodeSpan(reference.span);
  const note = optionalString(reference.note, "Finding reference note");
  const needsReview = optionalBoolean(
    reference.needsReview,
    "Finding reference needsReview"
  );

  if (reference.kind === "resource") {
    const resourceRevision = reference.resourceRevision;
    if (
      resourceRevision !== undefined &&
      typeof resourceRevision !== "string" &&
      typeof resourceRevision !== "number"
    ) {
      throw new InvestigationIngressError(
        "Finding resource reference resourceRevision must be a string or number"
      );
    }
    if (typeof resourceRevision === "number" && !Number.isFinite(resourceRevision)) {
      throw new InvestigationIngressError(
        "Finding resource reference resourceRevision must be finite"
      );
    }
    return {
      kind: "resource",
      resourceKind: requiredString(
        reference.resourceKind,
        "Finding resource reference resourceKind"
      ),
      resourceId: requiredString(
        reference.resourceId,
        "Finding resource reference resourceId"
      ),
      ...(reference.locator !== undefined
        ? { locator: optionalString(reference.locator, "Finding resource locator") }
        : {}),
      ...(resourceRevision !== undefined ? { resourceRevision } : {}),
      ...(span !== undefined ? { span } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(needsReview !== undefined ? { needsReview } : {})
    };
  }

  if (reference.kind === "url") {
    return {
      kind: "url",
      href: requiredString(reference.href, "Finding URL reference href"),
      observedAt: requiredString(
        reference.observedAt,
        "Finding URL reference observedAt"
      ),
      ...(span !== undefined ? { span } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(needsReview !== undefined ? { needsReview } : {})
    };
  }

  throw new InvestigationIngressError(
    "Finding reference kind must be resource or url"
  );
};

const decodeReferences = (value: unknown): readonly FindingReference[] => {
  if (!Array.isArray(value)) {
    throw new InvestigationIngressError("Finding references must be an array");
  }
  return value.map(decodeReference);
};

const decodeQuestionLinks = (value: unknown): readonly FindingQuestionLink[] => {
  if (!Array.isArray(value)) {
    throw new InvestigationIngressError("Finding questionLinks must be an array");
  }
  return value.map((entry) => {
    const link = record(entry, "Finding Question link");
    const relationship = optionalOneOf(
      link.relationship,
      FINDING_RELATIONSHIPS,
      "Finding Question relationship"
    );
    return {
      questionId: requiredString(link.questionId, "Finding Question link questionId"),
      ...(relationship !== undefined ? { relationship } : {})
    };
  });
};

const decodeHypothesisLinks = (
  value: unknown
): readonly FindingHypothesisLink[] => {
  if (!Array.isArray(value)) {
    throw new InvestigationIngressError("Finding hypothesisLinks must be an array");
  }
  return value.map((entry) => {
    const link = record(entry, "Finding Hypothesis link");
    const relationship = optionalOneOf(
      link.relationship,
      FINDING_RELATIONSHIPS,
      "Finding Hypothesis relationship"
    );
    return {
      hypothesisId: requiredString(
        link.hypothesisId,
        "Finding Hypothesis link hypothesisId"
      ),
      ...(relationship !== undefined ? { relationship } : {})
    };
  });
};

const decodeFindingCreate = (value: unknown): ProposeFindingRequest => {
  const body = record(value, "Finding proposal body");
  return {
    claim: requiredString(body.claim, "Finding claim"),
    references: decodeReferences(body.references),
    ...(body.commentary !== undefined
      ? { commentary: optionalString(body.commentary, "Finding commentary") }
      : {}),
    ...(body.tags !== undefined
      ? { tags: optionalStrings(body.tags, "Finding tags") }
      : {}),
    ...(body.questionLinks !== undefined
      ? { questionLinks: decodeQuestionLinks(body.questionLinks) }
      : {}),
    ...(body.hypothesisLinks !== undefined
      ? { hypothesisLinks: decodeHypothesisLinks(body.hypothesisLinks) }
      : {})
  };
};

const decodeFindingUpdate = (
  body: Record<string, unknown>
): UpdateFindingRequest => ({
  ...(body.claim !== undefined
    ? { claim: requiredString(body.claim, "Finding claim") }
    : {}),
  ...(body.references !== undefined
    ? { references: decodeReferences(body.references) }
    : {}),
  ...(body.commentary !== undefined
    ? { commentary: nullableString(body.commentary, "Finding commentary") }
    : {}),
  ...(body.tags !== undefined
    ? { tags: optionalStrings(body.tags, "Finding tags") }
    : {}),
  ...(body.questionLinks !== undefined
    ? { questionLinks: decodeQuestionLinks(body.questionLinks) }
    : {}),
  ...(body.hypothesisLinks !== undefined
    ? { hypothesisLinks: decodeHypothesisLinks(body.hypothesisLinks) }
    : {})
});

const errorResponse = (error: unknown): EndpointResponse => {
  if (error instanceof ResourceNotDeletedError) {
    return { statusCode: 409, body: { error: "not_deleted", message: error.message } };
  }
  if (error instanceof ResourceHistoryNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof InvestigationIngressError) {
    return {
      statusCode: 400,
      body: { error: "invalid_input", message: error.message }
    };
  }
  if (error instanceof InvestigationError) {
    const statusCode =
      error.code === "not_found" ? 404 : error.code === "invalid_operation" ? 409 : 400;
    return { statusCode, body: { error: error.code, message: error.message } };
  }
  return {
    statusCode: 500,
    body: { error: "internal_error", message: "Investigation request failed" }
  };
};

const execute = async (
  logger: Logger,
  event: string,
  requestId: string | undefined,
  details: Readonly<Record<string, unknown>>,
  work: () => Promise<EndpointResponse>
): Promise<EndpointResponse> => {
  const startedAt = performance.now();
  try {
    const response = await work();
    logger.debug(`${event}.completed`, {
      requestId,
      ...details,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return response;
  } catch (error) {
    const response = errorResponse(error);
    const metadata = {
      requestId,
      ...details,
      statusCode: response.statusCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
      // The name alone cannot tell an upstream 401 from a null dereference, and
      // this is the only record written for a 500.
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - startedAt)
    };
    if (response.statusCode >= 500) logger.error(`${event}.failed`, metadata);
    else logger.warn(`${event}.rejected`, metadata);
    return response;
  }
};

const queryRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

/** Registers the complete HTTP surface for the unified Investigation capability. */
export const registerInvestigationEndpoints = (
  registry: JobRegistry,
  investigation: InvestigationRuntime,
  logger: Logger
): void => {
  registry.register({ method: "POST", path: "/questions/create" }, (request) => ({
    name: "investigation.questions.create",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.create", request.requestId, {}, async () => ({
      statusCode: 201,
      body: await investigation.createQuestion(decodeQuestionCreate(request.body))
    }))
  }));

  registry.register({ method: "POST", path: "/questions/update" }, (request) => ({
    name: "investigation.questions.update",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.update", request.requestId, {}, async () => {
      const body = record(request.body, "Question update body");
      const id = requiredString(body.id, "Question id");
      return {
        statusCode: 200,
        body: await investigation.updateQuestion(id, decodeQuestionUpdate(body))
      };
    })
  }));

  registry.register({ method: "POST", path: "/questions/propose-answer" }, (request) => ({
    name: "investigation.questions.propose-answer",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.propose_answer", request.requestId, {}, async () => {
      const body = record(request.body, "Question answer proposal body");
      const id = requiredString(body.id, "Question id");
      const currentAnswer = requiredString(body.currentAnswer, "Question currentAnswer");
      return {
        statusCode: 200,
        body: await investigation.proposeQuestionAnswer(id, currentAnswer)
      };
    })
  }));

  for (const endpoint of [
    {
      path: "/questions/confirm-answer",
      name: "confirm-answer",
      event: "confirm_answer",
      invoke: (id: string) => investigation.confirmQuestionAnswer(id)
    },
    {
      path: "/questions/clear-answer",
      name: "clear-answer",
      event: "clear_answer",
      invoke: (id: string) => investigation.clearQuestionAnswer(id)
    }
  ] as const) {
    registry.register({ method: "POST", path: endpoint.path }, (request) => ({
      name: `investigation.questions.${endpoint.name}`,
      queueType: "serial",
      responseMode: "inline",
      work: () => execute(logger, `investigation.questions.${endpoint.event}`, request.requestId, {}, async () => {
        const body = record(request.body, "Question answer body");
        const id = requiredString(body.id, "Question id");
        return {
          statusCode: 200,
          body: await endpoint.invoke(id)
        };
      })
    }));
  }

  registry.register({ method: "GET", path: "/questions/get" }, (request) => ({
    name: "investigation.questions.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.get", request.requestId, {}, async () => {
        const id = requiredString(queryRecord(request.query).id, "Question id");
        const question = await investigation.getQuestion(id);
        return question
          ? { statusCode: 200, body: question }
          : { statusCode: 404, body: { error: "not_found", message: `Question not found: ${id}` } };
      })
  }));

  registry.register({ method: "GET", path: "/questions/list" }, (request) => ({
    name: "investigation.questions.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.list", request.requestId, {}, async () => {
      const query = queryRecord(request.query);
      const records = await investigation.listQuestions({
        ...(query.status !== undefined
          ? { status: oneOf(query.status, QUESTION_STATUSES, "Question status") }
          : {}),
        ...(query.tag !== undefined ? { tag: requiredString(query.tag, "Question tag") } : {})
      });
      return { statusCode: 200, body: { records } };
    })
  }));

  registry.register({ method: "DELETE", path: "/questions/delete" }, (request) => ({
    name: "investigation.questions.delete",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.delete", request.requestId, {}, async () => {
        const id = requiredString(queryRecord(request.query).id, "Question id");
        await investigation.deleteQuestion(id);
        return { statusCode: 204, body: null };
      })
  }));

  registry.register({ method: "POST", path: "/questions/purge" }, (request) => ({
    name: "investigation.questions.purge",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.questions.purge", request.requestId, {}, async () => {
      const id = requiredString(record(request.body, "Question purge body").id, "Question id");
      await investigation.purgeQuestion(id);
      return { statusCode: 204, body: null };
    })
  }));

  registry.register({ method: "POST", path: "/hypotheses/create" }, (request) => ({
    name: "investigation.hypotheses.create",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.hypotheses.create", request.requestId, {}, async () => ({
      statusCode: 201,
      body: await investigation.createHypothesis(decodeHypothesisCreate(request.body))
    }))
  }));

  registry.register({ method: "POST", path: "/hypotheses/update" }, (request) => ({
    name: "investigation.hypotheses.update",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.hypotheses.update", request.requestId, {}, async () => {
      const body = record(request.body, "Hypothesis update body");
      const id = requiredString(body.id, "Hypothesis id");
      return {
        statusCode: 200,
        body: await investigation.updateHypothesis(id, decodeHypothesisUpdate(body))
      };
    })
  }));

  registry.register({ method: "GET", path: "/hypotheses/get" }, (request) => ({
    name: "investigation.hypotheses.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.hypotheses.get", request.requestId, {}, async () => {
        const id = requiredString(queryRecord(request.query).id, "Hypothesis id");
        const hypothesis = await investigation.getHypothesis(id);
        return hypothesis
          ? { statusCode: 200, body: hypothesis }
          : { statusCode: 404, body: { error: "not_found", message: `Hypothesis not found: ${id}` } };
      })
  }));

  registry.register({ method: "GET", path: "/hypotheses/list" }, (request) => ({
    name: "investigation.hypotheses.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.hypotheses.list", request.requestId, {}, async () => {
      const query = queryRecord(request.query);
      const records = await investigation.listHypotheses({
        ...(query.questionId !== undefined
          ? { questionId: requiredString(query.questionId, "Question id") }
          : {}),
        ...(query.status !== undefined
          ? { status: oneOf(query.status, HYPOTHESIS_STATUSES, "Hypothesis status") }
          : {})
      });
      return { statusCode: 200, body: { records } };
    })
  }));

  registry.register({ method: "DELETE", path: "/hypotheses/delete" }, (request) => ({
    name: "investigation.hypotheses.delete",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.hypotheses.delete", request.requestId, {}, async () => {
        const id = requiredString(queryRecord(request.query).id, "Hypothesis id");
        await investigation.deleteHypothesis(id);
        return { statusCode: 204, body: null };
      })
  }));

  registry.register({ method: "POST", path: "/hypotheses/purge" }, (request) => ({
    name: "investigation.hypotheses.purge",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.hypotheses.purge", request.requestId, {}, async () => {
      const id = requiredString(record(request.body, "Hypothesis purge body").id, "Hypothesis id");
      await investigation.purgeHypothesis(id);
      return { statusCode: 204, body: null };
    })
  }));

  registry.register({ method: "POST", path: "/findings/propose" }, (request) => ({
    name: "investigation.findings.propose",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.findings.propose", request.requestId, {}, async () => ({
      statusCode: 201,
      body: await investigation.proposeFinding(decodeFindingCreate(request.body))
    }))
  }));

  registry.register({ method: "POST", path: "/findings/update" }, (request) => ({
    name: "investigation.findings.update",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.findings.update", request.requestId, {}, async () => {
      const body = record(request.body, "Finding update body");
      const id = requiredString(body.id, "Finding id");
      return {
        statusCode: 200,
        body: await investigation.updateFinding(id, decodeFindingUpdate(body))
      };
    })
  }));

  for (const endpoint of [
    {
      path: "/findings/accept",
      name: "accept",
      queueType: "concurrent" as const,
      invoke: (id: string) => investigation.acceptFinding(id)
    },
    {
      path: "/findings/unaccept",
      name: "unaccept",
      queueType: "serial" as const,
      invoke: (id: string) => investigation.unacceptFinding(id)
    },
    {
      path: "/findings/reject",
      name: "reject",
      queueType: "serial" as const,
      invoke: (id: string) => investigation.rejectFinding(id)
    }
  ] as const) {
    registry.register({ method: "POST", path: endpoint.path }, (request) => ({
      name: `investigation.findings.${endpoint.name}`,
      queueType: endpoint.queueType,
      responseMode: "inline",
      work: () => execute(logger, `investigation.findings.${endpoint.name}`, request.requestId, {}, async () => {
        const body = record(request.body, "Finding status body");
        const id = requiredString(body.id, "Finding id");
        return {
          statusCode: 200,
          body: await endpoint.invoke(id)
        };
      })
    }));
  }

  for (const endpoint of [
    {
      path: "/findings/mark-reference-review",
      name: "mark-reference-review",
      event: "mark_reference_review",
      invoke: (id: string, index: number) =>
        investigation.markFindingReferenceForReview(id, index)
    },
    {
      path: "/findings/clear-reference-review",
      name: "clear-reference-review",
      event: "clear_reference_review",
      invoke: (id: string, index: number) =>
        investigation.clearFindingReferenceReview(id, index)
    }
  ] as const) {
    registry.register({ method: "POST", path: endpoint.path }, (request) => ({
      name: `investigation.findings.${endpoint.name}`,
      queueType: "serial",
      responseMode: "inline",
      work: () => execute(logger, `investigation.findings.${endpoint.event}`, request.requestId, {}, async () => {
        const body = record(request.body, "Finding reference review body");
        const id = requiredString(body.id, "Finding id");
        const referenceIndex = safeInteger(body.referenceIndex, "Finding referenceIndex");
        return {
          statusCode: 200,
          body: await endpoint.invoke(id, referenceIndex)
        };
      })
    }));
  }

  registry.register({ method: "GET", path: "/findings/get" }, (request) => ({
    name: "investigation.findings.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.findings.get", request.requestId, {}, async () => {
        const id = requiredString(queryRecord(request.query).id, "Finding id");
        const finding = await investigation.getFinding(id);
        return finding
          ? { statusCode: 200, body: finding }
          : { statusCode: 404, body: { error: "not_found", message: `Finding not found: ${id}` } };
      })
  }));

  registry.register({ method: "GET", path: "/findings/list" }, (request) => ({
    name: "investigation.findings.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: () => execute(logger, "investigation.findings.list", request.requestId, {}, async () => {
      const query = queryRecord(request.query);
      const records = await investigation.listFindings({
        ...(query.status !== undefined
          ? { status: oneOf(query.status, FINDING_STATUSES, "Finding status") }
          : {}),
        ...(query.questionId !== undefined
          ? { questionId: requiredString(query.questionId, "Question id") }
          : {}),
        ...(query.hypothesisId !== undefined
          ? { hypothesisId: requiredString(query.hypothesisId, "Hypothesis id") }
          : {})
      });
      return { statusCode: 200, body: { records } };
    })
  }));

  registry.register({ method: "DELETE", path: "/findings/delete" }, (request) => ({
    name: "investigation.findings.delete",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.findings.delete", request.requestId, {}, async () => {
        const id = requiredString(queryRecord(request.query).id, "Finding id");
        await investigation.deleteFinding(id);
        return { statusCode: 204, body: null };
      })
  }));

  registry.register({ method: "POST", path: "/findings/purge" }, (request) => ({
    name: "investigation.findings.purge",
    queueType: "serial",
    responseMode: "inline",
    work: () => execute(logger, "investigation.findings.purge", request.requestId, {}, async () => {
      const id = requiredString(record(request.body, "Finding purge body").id, "Finding id");
      await investigation.purgeFinding(id);
      return { statusCode: 204, body: null };
    })
  }));

  logger.info("investigation.endpoints.registered", {
    count: 23,
    endpoints: [
      "POST /questions/create",
      "POST /questions/update",
      "POST /questions/propose-answer",
      "POST /questions/confirm-answer",
      "POST /questions/clear-answer",
      "GET /questions/get",
      "GET /questions/list",
      "DELETE /questions/delete",
      "POST /hypotheses/create",
      "POST /hypotheses/update",
      "GET /hypotheses/get",
      "GET /hypotheses/list",
      "DELETE /hypotheses/delete",
      "POST /findings/propose",
      "POST /findings/update",
      "POST /findings/accept",
      "POST /findings/unaccept",
      "POST /findings/reject",
      "POST /findings/mark-reference-review",
      "POST /findings/clear-reference-review",
      "GET /findings/get",
      "GET /findings/list",
      "DELETE /findings/delete"
    ]
  });
};

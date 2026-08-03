// One class per distinguishable failure. Job wiring maps these to status codes;
// nothing here mentions HTTP.

/** A definition that is structurally incoherent, or a malformed request. */
export class AnalyticValidationError extends Error {
  constructor(
    readonly field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = "AnalyticValidationError";
  }
}

/** Rejected by the strict wire decoder before the domain sees it. */
export class AnalyticWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticWireError";
  }
}

export class AnalyticNotFoundError extends Error {
  constructor(readonly analyticId: string) {
    super(`Structured Analytic not found: ${analyticId}`);
    this.name = "AnalyticNotFoundError";
  }
}

/** Purge was asked for while the analytic still exists. */
export class AnalyticNotDeletedError extends Error {
  constructor(readonly analyticId: string) {
    super(`Structured Analytic is still current: ${analyticId}`);
    this.name = "AnalyticNotDeletedError";
  }
}

export class StaleAnalyticRevisionError extends Error {
  constructor(
    readonly analyticId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number
  ) {
    super(
      `Structured Analytic ${analyticId} is at revision ${actualRevision}, not ${expectedRevision}`
    );
    this.name = "StaleAnalyticRevisionError";
  }
}

export class AnalyticCatalogLimitError extends Error {
  constructor(readonly limit: number) {
    super(`project already holds the maximum of ${limit} structured analytics`);
    this.name = "AnalyticCatalogLimitError";
  }
}

/** A save or copy target name is already taken in Structured Data. */
export class AnalyticNameConflictError extends Error {
  constructor(readonly name: string) {
    super(`Structured Data already holds an entry named ${name}`);
    this.name = "AnalyticNameConflictError";
  }
}

/**
 * The request was well-formed and the saved definition is structurally valid,
 * but the project data cannot satisfy it right now — a missing or unresolvable
 * input, a field that is not there, an incompatible value, or a size limit.
 */
export class AnalyticPullError extends Error {
  constructor(
    message: string,
    /** The input key at fault, when the failure is attributable to one. */
    readonly input?: string,
    /** A stable reason a client can branch on without matching the message. */
    readonly reason?: AnalyticPullFailureReason
  ) {
    super(message);
    this.name = "AnalyticPullError";
  }
}

export type AnalyticPullFailureReason =
  /** The name is not in the project, and no recorded entry resolves either. */
  | "input_not_found"
  /** The name exists but its entry failed to resolve — a broken formula upstream. */
  | "input_unresolved"
  /** The value resolved but is not table-like, or is a function. */
  | "input_not_tabular"
  /** Evaluation produced a diagnostic: bad field, incompatible kind, and so on. */
  | "evaluation_failed"
  /** The display's data-dependent expectation was not met. */
  | "display_unsatisfied"
  /** A Formula size limit was exceeded. */
  | "limit_exceeded";

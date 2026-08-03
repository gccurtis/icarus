// One class per distinguishable failure. Job wiring maps these to status codes;
// nothing here mentions HTTP.
//
// Purge-before-delete is deliberately absent, but NOT because the shared helper
// raises it. `purgeResourceHistory` returns a boolean, never throws, and never
// looks at the current table at all — it cannot tell a live resource from a
// deleted one. A store that trusts it to refuse would erase the history of a
// live analytic and report success.
//
// The store raises the shared `ResourceNotDeletedError` itself, from an explicit
// liveness guard, exactly as Templates does
// (templates/persistence/sqliteTemplateStore.ts:323). Using the shared class is
// still the win: every endpoint mapper in the repo already turns it into
// 409 `not_deleted`, and a capability-private twin would be missed by all of
// them.

/**
 * A definition that is structurally incoherent, or a malformed request.
 *
 * `reason` is kept alongside `message` so a caller does not have to strip the
 * `"<field>: "` prefix back off to get at it — the same split Persona makes.
 */
export class AnalyticValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`${field}: ${reason}`);
    this.name = "AnalyticValidationError";
  }
}

/**
 * The configured limits are unusable. An operator fault, not a caller's — it is
 * deliberately not an `AnalyticValidationError`, because job wiring maps those
 * to 400 and would blame the client for a bad `configuration.yaml` while
 * echoing an internal field name back to them.
 */
export class AnalyticConfigurationError extends Error {
  constructor(
    public readonly limit: string,
    public readonly reason: string
  ) {
    super(`structuredAnalytic.${limit}: ${reason}`);
    this.name = "AnalyticConfigurationError";
  }
}

/**
 * The definition is structurally valid but cannot be lowered into a Formula
 * expression — two placements colliding on an output column name, for instance.
 *
 * Save-time, like `AnalyticValidationError`, and mapped alongside it: a
 * definition that could never evaluate should be refused once, when it is
 * saved, rather than failing on every pull forever after.
 */
export class AnalyticCompilationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "AnalyticCompilationError";
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
  constructor(public readonly analyticId: string) {
    super(`Structured Analytic not found: ${analyticId}`);
    this.name = "AnalyticNotFoundError";
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

// There is no catalog-limit error. A per-project cap on how many analytics may
// exist belongs to a global resource-quota policy, not to this capability — the
// same call Templates made when `maxTemplatesPerProject` was dropped.

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

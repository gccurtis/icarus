import type { DocumentIdentityKind } from "./identities.js";

export class DocumentNotFoundError extends Error {
  constructor(public readonly documentId: string) {
    super(`Document not found: ${documentId}`);
    this.name = "DocumentNotFoundError";
  }
}

export class DocumentAttemptNotFoundError extends Error {
  constructor(public readonly attemptId: string) {
    super(`Document attempt not found: ${attemptId}`);
    this.name = "DocumentAttemptNotFoundError";
  }
}

export class RevisionConflictError extends Error {
  constructor(
    public readonly documentId: string,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(`Document ${documentId} revision conflict: expected ${expected}, current ${actual}`);
    this.name = "RevisionConflictError";
  }
}

export class IdempotencyMismatchError extends Error {
  constructor(public readonly requestId: string) {
    super(`Request ID was reused with different input: ${requestId}`);
    this.name = "IdempotencyMismatchError";
  }
}

export class CompensationConflictError extends Error {
  constructor(public readonly changeSetId: string, message?: string) {
    super(message ?? `ChangeSet cannot be compensated at the current head: ${changeSetId}`);
    this.name = "CompensationConflictError";
  }
}

export class HistoryPrunedError extends Error {
  constructor(public readonly documentId: string, public readonly revision: number) {
    super(`Document history is unavailable for ${documentId} revision ${revision}`);
    this.name = "HistoryPrunedError";
  }
}

export class InvalidDocumentCursorError extends Error {
  constructor() {
    super("Invalid Document pagination cursor");
    this.name = "InvalidDocumentCursorError";
  }
}

export class DocumentValidationError extends Error {
  constructor(public readonly diagnostics: string[]) {
    super(`Invalid Document: ${diagnostics.join("; ")}`);
    this.name = "DocumentValidationError";
  }
}

export class DocumentIdentityReuseError extends Error {
  constructor(
    public readonly documentId: string,
    public readonly identityId: string,
    public readonly previousKind: DocumentIdentityKind,
    public readonly requestedKind: DocumentIdentityKind
  ) {
    super(
      previousKind === requestedKind
        ? `Document identity cannot be reused: ${identityId}`
        : `Document identity '${identityId}' was previously claimed as ${previousKind} and cannot be reused as ${requestedKind}`
    );
    this.name = "DocumentIdentityReuseError";
  }
}

export class DocumentPlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentPlacementError";
  }
}

export class DocumentStyleReferenceError extends Error {
  constructor(public readonly styleId: string, message?: string) {
    super(message ?? `Document Style not found: ${styleId}`);
    this.name = "DocumentStyleReferenceError";
  }
}

export class DocumentOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentOperationError";
  }
}

export class DocumentStaleAttemptError extends Error {
  constructor(public readonly attemptId: string, message: string) {
    super(message);
    this.name = "DocumentStaleAttemptError";
  }
}

/**
 * A Prompt Block points at a Context Variable that has no target.
 *
 * Only reachable on a **template-mode** Document, where declaring a parameter
 * with no default is the point. Instantiation must bind every declared
 * parameter, so an ordinary Document cannot hold one — which is why this is an
 * error rather than a fallback: there is no legitimate case where a prompt
 * should run against nothing.
 */
export class DocumentUnboundContextVariableError extends Error {
  constructor(
    public readonly variableId: string,
    public readonly variableName: string
  ) {
    super(`Context Variable '${variableName}' is unbound and cannot ground a Prompt`);
    this.name = "DocumentUnboundContextVariableError";
  }
}

/**
 * Every public command and query naming a template-mode Document is refused
 * with this, reads included.
 *
 * Checked **once, on the document**, rather than enumerated per command — that
 * is the entire value of the rule. A command or query added later is sealed by
 * default instead of by someone remembering to add it to a list.
 *
 * A backing copy is not a Document a user owns any more. It exists so
 * instantiation has something to copy, and Templates reaches it by holding
 * Document's runtime object rather than going through this surface.
 */
export class DocumentTemplateModeError extends Error {
  constructor(public readonly documentId: string) {
    super(
      `Document '${documentId}' is a template. Use the Templates capability to read or edit it.`
    );
    this.name = "DocumentTemplateModeError";
  }
}

/**
 * A template binding names a Context Variable the Document does not have.
 *
 * Refused rather than ignored: the Template record's declaration and the backing
 * Document's variables would silently disagree from then on, and the catalog
 * would go on advertising a parameter that binds nothing.
 */
export class DocumentContextVariableNotFoundError extends Error {
  constructor(
    public readonly documentId: string,
    public readonly variableName: string
  ) {
    super(`Document '${documentId}' has no Context Variable named '${variableName}'`);
    this.name = "DocumentContextVariableNotFoundError";
  }
}

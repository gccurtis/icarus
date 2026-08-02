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

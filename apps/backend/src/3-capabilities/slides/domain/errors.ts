import type { SlideIdentityKind } from "./identities.js";

export class DeckNotFoundError extends Error {
  constructor(public readonly deckId: string) {
    super(`Deck not found: ${deckId}`);
    this.name = "DeckNotFoundError";
  }
}

export class SlideAttemptNotFoundError extends Error {
  constructor(public readonly attemptId: string) {
    super(`Deck attempt not found: ${attemptId}`);
    this.name = "SlideAttemptNotFoundError";
  }
}

export class RevisionConflictError extends Error {
  constructor(
    public readonly deckId: string,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(`Deck ${deckId} revision conflict: expected ${expected}, current ${actual}`);
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
  constructor(public readonly deckId: string, public readonly revision: number) {
    super(`Deck history is unavailable for ${deckId} revision ${revision}`);
    this.name = "HistoryPrunedError";
  }
}

export class InvalidDeckCursorError extends Error {
  constructor() {
    super("Invalid Deck pagination cursor");
    this.name = "InvalidDeckCursorError";
  }
}

export class SlideValidationError extends Error {
  constructor(public readonly diagnostics: string[]) {
    super(`Invalid Deck: ${diagnostics.join("; ")}`);
    this.name = "SlideValidationError";
  }
}

export class SlideIdentityReuseError extends Error {
  constructor(
    public readonly deckId: string,
    public readonly identityId: string,
    public readonly previousKind: SlideIdentityKind,
    public readonly requestedKind: SlideIdentityKind
  ) {
    super(
      previousKind === requestedKind
        ? `Deck identity cannot be reused: ${identityId}`
        : `Deck identity '${identityId}' was previously claimed as ${previousKind} and cannot be reused as ${requestedKind}`
    );
    this.name = "SlideIdentityReuseError";
  }
}

export class SlidePlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlidePlacementError";
  }
}

export class SlideStyleReferenceError extends Error {
  constructor(public readonly styleId: string, message?: string) {
    super(message ?? `Slide Style not found: ${styleId}`);
    this.name = "SlideStyleReferenceError";
  }
}

export class SlideTokenReferenceError extends Error {
  constructor(public readonly tokenId: string, message?: string) {
    super(message ?? `Design Token not found: ${tokenId}`);
    this.name = "SlideTokenReferenceError";
  }
}

export class SlideOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlideOperationError";
  }
}

export class SlideStaleAttemptError extends Error {
  constructor(public readonly attemptId: string, message: string) {
    super(message);
    this.name = "SlideStaleAttemptError";
  }
}

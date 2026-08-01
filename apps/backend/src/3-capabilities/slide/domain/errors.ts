import type { SlideIdentityKind } from "./identities.js";

export class DeckNotFoundError extends Error {
  constructor(public readonly deckId: string) {
    super(`Deck not found: ${deckId}`);
    this.name = "DeckNotFoundError";
  }
}

export class DeckAlreadyExistsError extends Error {
  constructor(public readonly deckId: string) {
    super(`Deck already exists: ${deckId}`);
    this.name = "DeckAlreadyExistsError";
  }
}

export class SlideAttemptNotFoundError extends Error {
  constructor(public readonly attemptId: string) {
    super(`Slide attempt not found: ${attemptId}`);
    this.name = "SlideAttemptNotFoundError";
  }
}

export class SlideRevisionConflictError extends Error {
  constructor(
    public readonly deckId: string,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(`Deck ${deckId} revision conflict: expected ${expected}, current ${actual}`);
    this.name = "SlideRevisionConflictError";
  }
}

export class SlideIdempotencyMismatchError extends Error {
  constructor(public readonly requestId: string) {
    super(`Request ID was reused with different input: ${requestId}`);
    this.name = "SlideIdempotencyMismatchError";
  }
}

export class SlideCompensationConflictError extends Error {
  constructor(public readonly changeSetId: string, message?: string) {
    super(message ?? `ChangeSet cannot be compensated at the current head: ${changeSetId}`);
    this.name = "SlideCompensationConflictError";
  }
}

export class SlideHistoryPrunedError extends Error {
  constructor(public readonly deckId: string, public readonly revision: number) {
    super(`Slide history is unavailable for ${deckId} revision ${revision}`);
    this.name = "SlideHistoryPrunedError";
  }
}

export class InvalidSlideCursorError extends Error {
  constructor() {
    super("Invalid Slide pagination cursor");
    this.name = "InvalidSlideCursorError";
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
        ? `Slide identity cannot be reused: ${identityId}`
        : `Slide identity '${identityId}' was previously claimed as ${previousKind} and cannot be reused as ${requestedKind}`
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

export class ActivityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityValidationError";
  }
}

/** A publisher reused a stable Activity transaction ID with different content. */
export class ActivityTransactionConflictError extends Error {
  constructor(transactionId: string) {
    super(`Activity transaction '${transactionId}' was published with different content`);
    this.name = "ActivityTransactionConflictError";
  }
}

export class InvalidActivityCursorError extends Error {
  constructor() {
    super("Activity cursor is invalid");
    this.name = "InvalidActivityCursorError";
  }
}

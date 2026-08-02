export class CommentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentValidationError";
  }
}

export class CommentWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentWireError";
  }
}

export class CommentNotFoundError extends Error {
  constructor(commentId: string) {
    super(`Comment '${commentId}' was not found`);
    this.name = "CommentNotFoundError";
  }
}

export class CommentIdempotencyMismatchError extends Error {
  constructor(requestId: string) {
    super(`Comment request '${requestId}' was reused with different content`);
    this.name = "CommentIdempotencyMismatchError";
  }
}

export class InvalidCommentCursorError extends Error {
  constructor() {
    super("Comment cursor is invalid for this target query");
    this.name = "InvalidCommentCursorError";
  }
}

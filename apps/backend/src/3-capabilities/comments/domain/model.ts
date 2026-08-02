export type IsoTimestamp = string;

export type CommentState = "open" | "resolved";
export type CommentOrigin = "user" | "agent" | "automation" | "system";

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** A project resource and an optional resource-owned opaque location hint. */
export interface CommentTarget {
  resourceKind: string;
  resourceId: string;
  subTarget?: JsonObject;
}

export interface Comment {
  id: string;
  body: string;
  mentions: string[];
  target: CommentTarget;
  state: CommentState;
  createdBy: string;
  updatedBy: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deletedAt?: IsoTimestamp;
}

/** Trusted attribution supplied by composition, never by the public payload. */
export interface CommentAttribution {
  actorId: string;
  origin: CommentOrigin;
}

export type CommentCommand =
  | {
      type: "comment.create";
      requestId: string;
      body: string;
      target: CommentTarget;
    }
  | {
      type: "comment.update";
      requestId: string;
      commentId: string;
      body: string;
    }
  | {
      type: "comment.resolve";
      requestId: string;
      commentId: string;
    }
  | {
      type: "comment.reopen";
      requestId: string;
      commentId: string;
    }
  | {
      type: "comment.delete";
      requestId: string;
      commentId: string;
    };

export type CommentCommandResult =
  | { type: "comment.created"; comment: Comment }
  | { type: "comment.updated"; comment: Comment }
  | { type: "comment.resolved"; comment: Comment }
  | { type: "comment.reopened"; comment: Comment }
  | { type: "comment.deleted"; commentId: string };

export type CommentQuery =
  | { type: "comment.get"; commentId: string }
  | {
      type: "comment.listByTarget";
      target: Pick<CommentTarget, "resourceKind" | "resourceId">;
      state?: CommentState;
      cursor?: string;
      limit?: number;
    };

export interface CommentPage {
  items: Comment[];
  nextCursor?: string;
}

export type CommentQueryResult =
  | { type: "comment.get"; comment?: Comment }
  | { type: "comment.listByTarget"; page: CommentPage };

export interface CommentCommandReceipt {
  requestId: string;
  requestDigest: string;
  result: CommentCommandResult;
  createdAt: IsoTimestamp;
}

export type CommentActivityOperation =
  | "created"
  | "updated"
  | "resolved"
  | "reopened"
  | "deleted";

/** Self-contained source-outbox record used to publish immutable Activity. */
export interface CommentActivityTransaction {
  transactionId: string;
  sourceRequestId: string;
  operation: CommentActivityOperation;
  commentId: string;
  resourceKind: string;
  resourceId: string;
  state: CommentState;
  mentionCount: number;
  actorId: string;
  origin: CommentOrigin;
  occurredAt: IsoTimestamp;
  publishedAt?: IsoTimestamp;
}

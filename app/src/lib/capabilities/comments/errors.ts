import { ConvexError } from "convex/values";

export type CommentsErrorCode =
  /** A thread or a comment that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** The `within` variant is not one that target can hold. */
  | "anchor-mismatch"
  /** A text range that ends before it starts. */
  | "anchor-range"
  /** What the anchor points at is not in the resource any more. */
  | "anchor-missing"
  /** The revision the selection was made against has left the rebase window. */
  | "anchor-stale"
  /** A remark with nothing in it. */
  | "empty-body"
  /** Editing words attributed to somebody else. */
  | "not-author"
  /** Resolving a resolved thread, or reopening an open one. */
  | "wrong-status";

export type CommentsRefusal = {
  readonly capability: "comments";
  readonly code: CommentsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "you cannot put a cell anchor on a document" thrown as a plain `Error` reaches
 * the author as an opaque server fault — and it is the one thing they need told.
 */
export class CommentsError extends ConvexError<CommentsRefusal> {
  constructor(code: CommentsErrorCode, message: string) {
    super({ capability: "comments", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const commentsRefusal = (error: unknown): CommentsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as CommentsRefusal).capability === "comments"
    ? (data as CommentsRefusal)
    : undefined;
};

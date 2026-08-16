import { ConvexError } from "convex/values";

export type DocumentsErrorCode = "not-found" | "empty-title";

export type DocumentsRefusal = {
  readonly capability: "documents";
  readonly code: DocumentsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted to an opaque server error. So the two
 * refusals stated in `overview.md` only reach a view as refusals by being
 * thrown as this — a plain `Error` makes "that document is not yours" and "the
 * server broke" the same answer.
 */
export class DocumentsError extends ConvexError<DocumentsRefusal> {
  constructor(code: DocumentsErrorCode, message: string) {
    super({ capability: "documents", code, message });
  }
}

/**
 * Reads a refusal out of whatever a caller caught.
 *
 * The class does not survive the wire, so a client cannot use `instanceof` and
 * has to look at `data`. The `capability` field is what tells it whose refusal
 * it caught.
 */
export const documentsRefusal = (error: unknown): DocumentsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as DocumentsRefusal).capability === "documents"
    ? (data as DocumentsRefusal)
    : undefined;
};

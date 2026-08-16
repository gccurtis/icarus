import { ConvexError } from "convex/values";

export type ExternalFilesErrorCode = "not-found" | "empty-name" | "upload-needs-user";

export type ExternalFilesRefusal = {
  readonly capability: "externalFiles";
  readonly code: ExternalFilesErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted to an opaque server error. Thrown as a plain
 * `Error`, "an agent cannot upload a file" would reach the caller as "the server
 * broke" — which is not a refusal at all.
 */
export class ExternalFilesError extends ConvexError<ExternalFilesRefusal> {
  constructor(code: ExternalFilesErrorCode, message: string) {
    super({ capability: "externalFiles", code, message });
  }
}

/**
 * Reads a refusal out of whatever a caller caught. The class does not survive
 * the wire, so `capability` is what tells a client whose refusal it caught.
 */
export const externalFilesRefusal = (error: unknown): ExternalFilesRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as ExternalFilesRefusal).capability === "externalFiles"
    ? (data as ExternalFilesRefusal)
    : undefined;
};

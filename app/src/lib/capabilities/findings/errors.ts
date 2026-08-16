import { ConvexError } from "convex/values";

export type FindingsErrorCode =
  /** A finding that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** A finding nothing can list, link to, or cite. */
  | "empty-title"
  /** The revision the form was opened at is not the one stored. */
  | "stale"
  /** A citation with nothing to go back to. */
  | "empty-source"
  /** A capture time that is not a moment, so the excerpt is dated to nothing. */
  | "source-captured-at";

export type FindingsRefusal = {
  readonly capability: "findings";
  readonly code: FindingsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "this citation points nowhere" thrown as a plain `Error` reaches the author as
 * an opaque server fault, and the writeup they were saving is lost with no
 * reason given.
 */
export class FindingsError extends ConvexError<FindingsRefusal> {
  constructor(code: FindingsErrorCode, message: string) {
    super({ capability: "findings", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const findingsRefusal = (error: unknown): FindingsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as FindingsRefusal).capability === "findings"
    ? (data as FindingsRefusal)
    : undefined;
};

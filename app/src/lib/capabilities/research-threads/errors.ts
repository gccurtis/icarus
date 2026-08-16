import { ConvexError } from "convex/values";

export type ResearchThreadsErrorCode =
  /** A thread, or an anchor, that is absent or someone else's. Never told apart. */
  | "not-found"
  /** A thread with nothing said about what it is working on. */
  | "empty-title"
  /** A mode the model does not have. */
  | "unknown-mode"
  /** A `question` or `hypothesis` thread with nothing to be about. */
  | "missing-anchor"
  /** An anchor the mode does not name — a `discover` thread pointed at a question. */
  | "mismatched-anchor"
  /** The revision the form was opened at is not the one stored. */
  | "stale";

export type ResearchThreadsRefusal = {
  readonly capability: "researchThreads";
  readonly code: ResearchThreadsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "a question thread is about a question" thrown as a plain `Error` reaches the
 * author as an opaque server fault, and the thread they were starting is lost
 * with nothing said about why.
 */
export class ResearchThreadsError extends ConvexError<ResearchThreadsRefusal> {
  constructor(code: ResearchThreadsErrorCode, message: string) {
    super({ capability: "researchThreads", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const researchThreadsRefusal = (error: unknown): ResearchThreadsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as ResearchThreadsRefusal).capability === "researchThreads"
    ? (data as ResearchThreadsRefusal)
    : undefined;
};

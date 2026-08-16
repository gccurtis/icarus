import { ConvexError } from "convex/values";

export type ResearchLinksErrorCode =
  /** An endpoint or a link that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** A (bearer, subject) pairing the model does not have. */
  | "illegal-pair"
  /** A bearing on a link whose bearer is not evidence. */
  | "bearing-not-evidence"
  /** A bearing the model does not have. */
  | "unknown-bearing"
  /** The same edge, already stored. Direction is canonical, so it is the same edge. */
  | "duplicate";

export type ResearchLinksRefusal = {
  readonly capability: "researchLinks";
  readonly code: ResearchLinksErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "a hypothesis proposes rather than evidences" thrown as a plain `Error`
 * reaches the author as an opaque server fault, and the link they were drawing
 * disappears without a reason.
 */
export class ResearchLinksError extends ConvexError<ResearchLinksRefusal> {
  constructor(code: ResearchLinksErrorCode, message: string) {
    super({ capability: "researchLinks", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const researchLinksRefusal = (error: unknown): ResearchLinksRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as ResearchLinksRefusal).capability === "researchLinks"
    ? (data as ResearchLinksRefusal)
    : undefined;
};

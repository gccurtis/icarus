import { ConvexError } from "convex/values";

export type HypothesesErrorCode =
  /** A hypothesis that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** A hypothesis that claims nothing. */
  | "empty-statement"
  /** The revision the form was opened at is not the one stored. */
  | "stale"
  /** An assessment the model does not have. */
  | "unknown-assessment"
  /** A confidence on a claim nobody has tested. */
  | "confidence-untested"
  /** A confidence outside 0–1, which is not a probability. */
  | "confidence-range";

export type HypothesesRefusal = {
  readonly capability: "hypotheses";
  readonly code: HypothesesErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "an untested hypothesis has no confidence to report" thrown as a plain `Error`
 * reaches the author as an opaque server fault, and the number they typed
 * disappears without a reason.
 */
export class HypothesesError extends ConvexError<HypothesesRefusal> {
  constructor(code: HypothesesErrorCode, message: string) {
    super({ capability: "hypotheses", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const hypothesesRefusal = (error: unknown): HypothesesRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as HypothesesRefusal).capability === "hypotheses"
    ? (data as HypothesesRefusal)
    : undefined;
};

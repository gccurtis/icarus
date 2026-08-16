import { ConvexError } from "convex/values";

export type DerivedOutputsErrorCode =
  /** An output that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** A prompt with nothing in it, which is a row that can never generate. */
  | "empty-prompt"
  /** A lattice input with nothing to search for. */
  | "empty-query"
  /** A lattice limit that admits nothing. */
  | "lattice-limit"
  /** A generation that produced several blocks where a position holds one. */
  | "block-list";

export type DerivedOutputsRefusal = {
  readonly capability: "derived-outputs";
  readonly code: DerivedOutputsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so a
 * generator handed "that came back as three blocks" as a plain `Error` sees an
 * opaque server fault — and retries it, forever, against a model that will keep
 * answering the same way.
 */
export class DerivedOutputsError extends ConvexError<DerivedOutputsRefusal> {
  constructor(code: DerivedOutputsErrorCode, message: string) {
    super({ capability: "derived-outputs", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const derivedOutputsRefusal = (error: unknown): DerivedOutputsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as DerivedOutputsRefusal).capability === "derived-outputs"
    ? (data as DerivedOutputsRefusal)
    : undefined;
};

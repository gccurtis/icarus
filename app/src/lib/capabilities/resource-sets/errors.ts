import { ConvexError } from "convex/values";

export type ResourceSetsErrorCode =
  /** A set that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** A set nothing can pick out of a list. */
  | "empty-name"
  /** The revision the form was opened at is not the one stored. */
  | "stale"
  /** Sets that reference each other, so resolving one would never finish. */
  | "cycle";

/** A set on the walk that produced a refusal, named so the author can find it. */
export type SetStep = {
  readonly id: string;
  readonly name: string;
};

export type ResourceSetsRefusal = {
  readonly capability: "resourceSets";
  readonly code: ResourceSetsErrorCode;
  readonly message: string;
  /**
   * The loop, in the order it was walked, closing on the set it came back to.
   *
   * It is a field rather than a sentence in `message` because the message is
   * prose and the cycle is the answer: whoever has to break the loop needs to
   * know which sets are in it, and a client cannot parse that out of English.
   */
  readonly cycle?: SetStep[];
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so a
 * cycle thrown as a plain `Error` reaches the author as an opaque server fault —
 * and a cycle is precisely the failure whose *contents* are the fix.
 */
export class ResourceSetsError extends ConvexError<ResourceSetsRefusal> {
  constructor(code: ResourceSetsErrorCode, message: string, cycle?: SetStep[]) {
    super({ capability: "resourceSets", code, message, ...(cycle ? { cycle } : {}) });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const resourceSetsRefusal = (error: unknown): ResourceSetsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as ResourceSetsRefusal).capability === "resourceSets"
    ? (data as ResourceSetsRefusal)
    : undefined;
};

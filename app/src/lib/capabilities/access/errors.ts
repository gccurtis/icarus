import { ConvexError } from "convex/values";

export type AccessErrorCode = "unauthenticated" | "no-such-project";

export type AccessRefusal = {
  readonly capability: "access";
  readonly code: AccessErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted. So extending it is what lets a browser
 * distinguish "that project is not yours" from "the server broke", and the
 * platform draws that line rather than a wrapper each function remembers to
 * call.
 */
export class AccessError extends ConvexError<AccessRefusal> {
  constructor(code: AccessErrorCode, message: string) {
    super({ capability: "access", code, message });
  }
}

/**
 * Reads a refusal out of whatever a caller caught.
 *
 * The class does not survive the wire — Convex serializes the payload and
 * nothing else — so a client cannot use `instanceof` and has to look at `data`.
 * This is what lets a view show "no such project" instead of a stack trace, and
 * it is the reason a refusal carries a `capability` field at all: a caller
 * catching one needs to know whose refusal it is.
 */
export const accessRefusal = (error: unknown): AccessRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as AccessRefusal).capability === "access"
    ? (data as AccessRefusal)
    : undefined;
};

/**
 * `no-such-project` rather than a distinct "not a member".
 *
 * Telling an unauthorized caller that a project exists is itself a disclosure,
 * so a token that resolves to nothing and a token belonging to someone else
 * answer identically.
 */
export function noSuchProject(): never {
  throw new AccessError("no-such-project", "No such project");
}

import { ConvexError } from "convex/values";

export type SlideDecksErrorCode = "not-found" | "empty-title";

export type SlideDecksRefusal = {
  readonly capability: "slideDecks";
  readonly code: SlideDecksErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted to an opaque server error. So a refusal
 * thrown as a plain `Error` makes "that deck is not yours" and "the server
 * broke" the same answer.
 */
export class SlideDecksError extends ConvexError<SlideDecksRefusal> {
  constructor(code: SlideDecksErrorCode, message: string) {
    super({ capability: "slideDecks", code, message });
  }
}

/**
 * Reads a refusal out of whatever a caller caught.
 *
 * The class does not survive the wire, so a client cannot use `instanceof` and
 * has to look at `data`. The `capability` field is what tells it whose refusal
 * it caught.
 */
export const slideDecksRefusal = (error: unknown): SlideDecksRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as SlideDecksRefusal).capability === "slideDecks"
    ? (data as SlideDecksRefusal)
    : undefined;
};

import { ConvexError } from "convex/values";

export type MessagesErrorCode =
  /** A prompt with nobody asking. Absence means "the responder", which a prompt has no case for. */
  "prompt-unauthored";

export type MessagesRefusal = {
  readonly capability: "messages";
  readonly code: MessagesErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted to an opaque server error. That matters more
 * here than it looks, because `message()` is called inside *another*
 * capability's mutation — a research thread, an agent task, a persona thread —
 * so the throw crosses the wire regardless of which file raised it, and a plain
 * `Error` would reach the author as "the server broke" with the turn they were
 * sending lost and no reason given.
 */
export class MessagesError extends ConvexError<MessagesRefusal> {
  constructor(code: MessagesErrorCode, message: string) {
    super({ capability: "messages", code, message });
  }
}

/**
 * Reads a refusal out of whatever a caller caught.
 *
 * The class does not survive the wire — Convex serializes the payload and
 * nothing else — so a client cannot use `instanceof` and has to look at `data`.
 * The `capability` field is why: a caller catching one needs to know whose
 * refusal it is.
 */
export const messagesRefusal = (error: unknown): MessagesRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as MessagesRefusal).capability === "messages"
    ? (data as MessagesRefusal)
    : undefined;
};

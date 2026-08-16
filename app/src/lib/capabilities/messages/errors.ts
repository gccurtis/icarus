import { ConvexError } from "convex/values";

export type MessagesErrorCode =
  /** A message that is absent, or in another project. Never told apart. */
  | "not-found"
  /** A prompt with nobody asking. Absence means "the responder", which a prompt has no case for. */
  | "prompt-unauthored"
  /** A turn that already ended. Finishing it again would rewrite what was said. */
  | "not-streaming";

export type MessagesRefusal = {
  readonly capability: "messages";
  readonly code: MessagesErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so a
 * refusal thrown as a plain `Error` reaches the author as an opaque server fault
 * and the turn they were sending is lost with no reason given.
 */
export class MessagesError extends ConvexError<MessagesRefusal> {
  constructor(code: MessagesErrorCode, message: string) {
    super({ capability: "messages", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const messagesRefusal = (error: unknown): MessagesRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as MessagesRefusal).capability === "messages"
    ? (data as MessagesRefusal)
    : undefined;
};

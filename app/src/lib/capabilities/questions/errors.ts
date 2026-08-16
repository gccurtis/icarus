import { ConvexError } from "convex/values";

export type QuestionsErrorCode =
  /** A question that is absent, or someone else's. Never told apart. */
  | "not-found"
  /** A question with nothing asked in it. */
  | "empty-text"
  /** A status the model does not have — `parked`, most likely. */
  | "unknown-status"
  /** The revision the form was opened at is not the one stored. */
  | "stale"
  /** Deleting a question that others hang off, which would strand them. */
  | "has-children"
  /** A parent that is the question itself, or below it. */
  | "cycle";

export type QuestionsRefusal = {
  readonly capability: "questions";
  readonly code: QuestionsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "this question moved while your form was open" thrown as a plain `Error`
 * reaches the author as a server fault — and it is the one thing they need told,
 * because rejection is the whole of the stale-form mechanism.
 */
export class QuestionsError extends ConvexError<QuestionsRefusal> {
  constructor(code: QuestionsErrorCode, message: string) {
    super({ capability: "questions", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const questionsRefusal = (error: unknown): QuestionsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as QuestionsRefusal).capability === "questions"
    ? (data as QuestionsRefusal)
    : undefined;
};

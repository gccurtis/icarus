import { ConvexError } from "convex/values";

export type SpreadsheetsErrorCode = "not-found" | "empty-title";

export type SpreadsheetsRefusal = {
  readonly capability: "spreadsheets";
  readonly code: SpreadsheetsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted to an opaque server error. So a refusal
 * thrown as a plain `Error` makes "that workbook is not yours" and "the server
 * broke" the same answer.
 */
export class SpreadsheetsError extends ConvexError<SpreadsheetsRefusal> {
  constructor(code: SpreadsheetsErrorCode, message: string) {
    super({ capability: "spreadsheets", code, message });
  }
}

/**
 * Reads a refusal out of whatever a caller caught.
 *
 * The class does not survive the wire, so a client cannot use `instanceof` and
 * has to look at `data`. The `capability` field is what tells it whose refusal
 * it caught.
 */
export const spreadsheetsRefusal = (error: unknown): SpreadsheetsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as SpreadsheetsRefusal).capability === "spreadsheets"
    ? (data as SpreadsheetsRefusal)
    : undefined;
};

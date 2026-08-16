import { ConvexError } from "convex/values";

export type NameManagerErrorCode =
  | "name-conflict"
  | "type-mismatch"
  | "empty-name"
  | "not-found"
  | "not-tabular";

export type NameManagerRefusal = {
  readonly capability: "nameManager";
  readonly code: NameManagerErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so a
 * name conflict thrown as a plain `Error` reaches the author as an opaque server
 * fault — and "that name is taken" is the one thing they need to be told.
 */
export class NameManagerError extends ConvexError<NameManagerRefusal> {
  constructor(code: NameManagerErrorCode, message: string) {
    super({ capability: "nameManager", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const nameManagerRefusal = (error: unknown): NameManagerRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as NameManagerRefusal).capability === "nameManager"
    ? (data as NameManagerRefusal)
    : undefined;
};

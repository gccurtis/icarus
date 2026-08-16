import { ConvexError } from "convex/values";

export type PersonasErrorCode =
  /** A persona that is absent, or belongs to another project. Never told apart. */
  | "not-found"
  /** A persona nobody can address, mention, or pick out of a list. */
  | "empty-name"
  /** Five empty sections and no scope: nothing to work on and nothing to say. */
  | "empty-definition"
  /** A global persona, edited from inside one project. Copy it instead. */
  | "not-editable"
  /** The revision the form was opened at is not the one stored. */
  | "stale";

export type PersonasRefusal = {
  readonly capability: "personas";
  readonly code: PersonasErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "that persona is global, edit a copy" thrown as a plain `Error` reaches the
 * author as an opaque server fault — and it is the one thing they need told.
 */
export class PersonasError extends ConvexError<PersonasRefusal> {
  constructor(code: PersonasErrorCode, message: string) {
    super({ capability: "personas", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const personasRefusal = (error: unknown): PersonasRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as PersonasRefusal).capability === "personas"
    ? (data as PersonasRefusal)
    : undefined;
};

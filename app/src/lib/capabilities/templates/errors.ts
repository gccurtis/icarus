import { ConvexError } from "convex/values";

export type TemplatesErrorCode =
  | "not-found"
  | "empty-name"
  | "duplicate-slot-key"
  | "slot-prompt"
  | "not-editable"
  | "target-changed"
  | "stale";

export type TemplatesRefusal = {
  readonly capability: "templates";
  readonly code: TemplatesErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so
 * "that template is global, edit a copy" thrown as a plain `Error` reaches the
 * author as an opaque server fault — and it is the one thing they need told.
 */
export class TemplatesError extends ConvexError<TemplatesRefusal> {
  constructor(code: TemplatesErrorCode, message: string) {
    super({ capability: "templates", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const templatesRefusal = (error: unknown): TemplatesRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as TemplatesRefusal).capability === "templates"
    ? (data as TemplatesRefusal)
    : undefined;
};

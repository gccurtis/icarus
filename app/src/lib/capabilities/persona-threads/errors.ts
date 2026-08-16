import { ConvexError } from "convex/values";

export type PersonaThreadsErrorCode =
  /** A thread, or a branch point, that is absent or in another project. Never told apart. */
  | "not-found"
  /** A chat with nothing in the list to show for it. */
  | "empty-title";

export type PersonaThreadsRefusal = {
  readonly capability: "personaThreads";
  readonly code: PersonaThreadsErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so a
 * refusal thrown as a plain `Error` arrives as a server fault and the branch
 * somebody was taking is lost with nothing said about why.
 *
 * A persona nobody can see is refused by
 * [`requirePersona`](../personas/api/shared/require-persona.ts) and arrives as
 * the personas capability's refusal, unchanged — it owns that rule, and
 * restating it here is how two answers to one question start to differ.
 */
export class PersonaThreadsError extends ConvexError<PersonaThreadsRefusal> {
  constructor(code: PersonaThreadsErrorCode, message: string) {
    super({ capability: "personaThreads", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const personaThreadsRefusal = (error: unknown): PersonaThreadsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as PersonaThreadsRefusal).capability === "personaThreads"
    ? (data as PersonaThreadsRefusal)
    : undefined;
};

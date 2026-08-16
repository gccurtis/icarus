import { ConvexError } from "convex/values";

export type KnowledgeErrorCode = "embedding-changed" | "embedder-failed";

export type KnowledgeRefusal = {
  readonly capability: "knowledge";
  readonly code: KnowledgeErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller;
 * anything else thrown is redacted to an opaque server error. "The embedding
 * binding moved, rebuild the lattice" is an instruction someone can act on, and
 * thrown as a plain `Error` it would reach a view as "the server broke".
 */
export class KnowledgeError extends ConvexError<KnowledgeRefusal> {
  constructor(code: KnowledgeErrorCode, message: string) {
    super({ capability: "knowledge", code, message });
  }
}

/** Reads a refusal out of whatever a caller caught. The class does not survive the wire. */
export const knowledgeRefusal = (error: unknown): KnowledgeRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as KnowledgeRefusal).capability === "knowledge"
    ? (data as KnowledgeRefusal)
    : undefined;
};

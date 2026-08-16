import { ConvexError } from "convex/values";
import type { ResourceKey } from "$revisions/types/change";

export type RevisionsErrorCode =
  | "not-found"
  /** 1 — the sets needed to evaluate this change have left the rebase window. */
  | "base-outside-window"
  /** 2 — something else reached for an id this change addresses. */
  | "touched-intersects"
  /** 3 — an id in this change's path was removed while it was being authored. */
  | "removed-under-edit"
  /** 4 — the window moved the block's text by an amount its ops do not state. */
  | "not-plain-text"
  /** 4 — the offsets fall inside text that was replaced. */
  | "offsets-overlap";

export type RevisionsRefusal = {
  readonly capability: "revisions";
  readonly code: RevisionsErrorCode;
  readonly message: string;
  /** Which rung of the ladder refused; absent for a refusal outside it. */
  readonly step?: number;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * `ConvexError`'s payload is the one thing Convex serializes to a caller, so a
 * rejection thrown as a plain `Error` arrives as an opaque server fault — and a
 * conflict with no reason is unactionable. A client that knows which rung
 * refused knows what to do next: re-read at the current revision, reapply the
 * edits still in its buffer, and resubmit.
 */
export class RevisionsError extends ConvexError<RevisionsRefusal> {
  constructor(code: RevisionsErrorCode, message: string, step?: number) {
    super({ capability: "revisions", code, message, step });
  }
}

/**
 * The one answer for a resource that is absent and a resource that is someone
 * else's. Distinguishing them confirms the resource exists to a caller with no
 * right to know that.
 */
export const notFound = (resource: ResourceKey): RevisionsError =>
  new RevisionsError("not-found", `Not found: ${resource.resourceType} ${resource.resourceId}`);

/**
 * Reads a refusal out of whatever a caller caught.
 *
 * The class does not survive the wire, so a client cannot use `instanceof` and
 * has to look at `data`. The `capability` field is what tells it whose refusal
 * it caught.
 */
export const revisionsRefusal = (error: unknown): RevisionsRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as RevisionsRefusal).capability === "revisions"
    ? (data as RevisionsRefusal)
    : undefined;
};

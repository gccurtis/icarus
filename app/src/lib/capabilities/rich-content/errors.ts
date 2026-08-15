/**
 * The error Rich Content raises, and the codes it raises it with.
 *
 * At the capability root rather than in `types/` because a consumer catching one
 * is using the public contract. A code is a decision this capability made and
 * states; anything thrown without one is a fault, and the two are recorded
 * differently.
 *
 * `stale-version` is the one worth knowing about: it means the content moved
 * under the caller, and the right response is to re-read `display` and try
 * again — not to retry the same request, which would fail identically.
 */
export type RichContentErrorCode =
  | "content-not-found"
  | "atom-not-found"
  | "stale-version"
  | "invalid-atom-range"
  | "invalid-display-range"
  | "invalid-list-presentation"
  | "invalid-style"
  | "invalid-link"
  | "invalid-list-source"
  | "unsupported-text";

export class RichContentError extends Error {
  constructor(
    readonly code: RichContentErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RichContentError";
  }
}

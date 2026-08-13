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

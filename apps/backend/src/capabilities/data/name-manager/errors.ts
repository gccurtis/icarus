export type NameManagerErrorCode =
  | "invalid-name"
  | "name-conflict"
  | "invalid-type"
  | "invalid-schema"
  | "invalid-value"
  | "variable-not-found";

export class NameManagerError extends Error {
  constructor(
    readonly code: NameManagerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "NameManagerError";
  }
}

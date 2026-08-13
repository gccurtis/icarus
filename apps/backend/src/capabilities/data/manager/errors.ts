export type DataManagerErrorCode =
  | "invalid-name"
  | "name-conflict"
  | "invalid-type"
  | "invalid-schema"
  | "invalid-value"
  | "variable-not-found";

export class DataManagerError extends Error {
  constructor(
    readonly code: DataManagerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DataManagerError";
  }
}
